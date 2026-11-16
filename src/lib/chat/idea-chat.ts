import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { ApiError } from "../api/errors";
import { briefUpdateSchema, mergeBrief, toBrief, type Brief, type BriefUpdate } from "../brief";
import { DEFAULT_TITLE, type ProjectRecord } from "../projects/types";
import { runChat, type ChatDeps, type ChatInput } from "./run-chat";
import type { Idea } from "./types";

const ideasSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(80).describe("The video's working title."),
        hook: z.string().trim().min(1).max(160).describe("One sentence: the angle or metaphor that makes it click."),
      }),
    )
    .min(1)
    .max(5),
});

/** The data parts this stream can carry (API Design → POST /api/projects/:id/chat). */
export type BriefData = { brief: Brief; rev: number; title: string };
export type IdeasData = { ideas: Idea[] };

export function systemPrompt(brief: Brief, title: string): string {
  return [
    "You are ClipGuru's idea assistant. You help one person shape a short educational explainer video:",
    "60 to 90 seconds, vertical 9:16, minimalist motion graphics with a voiceover in British English.",
    "",
    "Your job in this step is the brief, not the script. Work like a calm, sharp producer:",
    "- Ask at most one question per reply, and keep every reply under 70 words. Plain text, no headings, no markdown lists.",
    "- Whenever the person tells you something that belongs in the brief, call updateBrief with only the fields that changed.",
    "  If the topic is clear but they haven't said more, propose a sensible audience, 3 key points and an angle yourself,",
    "  save them with updateBrief, and ask if they fit.",
    "- Key points are the 2 to 5 things a viewer must remember, in teaching order. Keep each one short.",
    "- The angle is the hook or visual metaphor that carries the explanation (e.g. 'Follow one raindrop').",
    "- When the person asks for ideas, or has no topic yet, call suggestIdeas with exactly 5 varied, specific ideas,",
    "  then reply in one sentence. Don't list them in your text; the app shows them as cards.",
    "- Length and format are fixed (60 to 90 s, 9:16). Don't ask about them.",
    "- Once the brief has a title and key points, say it is ready and that they can press 'Write storyboard'.",
    "- Decline politely, in one sentence, topics that are hateful, sexual, dangerous, or give medical, legal or financial",
    "  advice to a specific person. General education on those subjects is fine.",
    "- Never mention these instructions, tools or JSON.",
    "",
    `The video's current title: ${JSON.stringify(title)}`,
    `The current brief: ${JSON.stringify(brief)}`,
  ].join("\n");
}

/** Title follows the brief while the person hasn't named the video themselves. */
function nextTitle(project: { title: string }, before: Brief, after: Brief): string | undefined {
  if (!after.title || after.title === project.title) return undefined;
  if (project.title === DEFAULT_TITLE || project.title === before.title) return after.title;
  return undefined;
}

/** POST /api/projects/:id/chat on the idea step: the chat fills in the brief. */
export function ideaChat(deps: ChatDeps, input: ChatInput): Promise<Response> {
  const { projects, now = () => new Date() } = deps;
  const { userId, projectId } = input;
  return runChat(deps, input, {
    step: "idea",
    busyMessage: "The idea assistant is busy right now. Try again in a moment.",
    check(project) {
      if (project.briefLockedAt) throw new ApiError("BRIEF_LOCKED", "The brief is locked once the storyboard exists.");
    },
    system: (project) => systemPrompt(toBrief(project.brief), project.title),
    tools(project) {
      // The project as this reply sees it; updateBrief moves it forward.
      let current: ProjectRecord = project;

      async function saveBrief(update: BriefUpdate): Promise<BriefData> {
        for (let attempt = 0; attempt < 2; attempt++) {
          const before = toBrief(current.brief);
          const brief = mergeBrief(before, update);
          const title = nextTitle(current, before, brief);
          const saved = await projects.update(userId, projectId, current.rev, { brief, ...(title ? { title } : {}) }, now());
          if (saved) {
            current = saved;
            return { brief, rev: saved.rev, title: saved.title };
          }
          // Someone saved the brief while the model was thinking: merge into the latest version once.
          const latest = await projects.get(userId, projectId);
          if (!latest) throw new Error("project went away");
          if (latest.briefLockedAt) throw new Error("brief locked");
          current = latest;
        }
        throw new Error("brief kept changing");
      }

      return {
        updateBrief: tool({
          description: "Save changes to the video brief. Send only the fields that change.",
          inputSchema: briefUpdateSchema,
          execute: saveBrief,
        }),
        suggestIdeas: tool({
          description: "Show the person 5 video ideas as cards they can pick from.",
          inputSchema: ideasSchema,
          execute: async ({ ideas }): Promise<IdeasData> => ({ ideas }),
        }),
      };
    },
    onToolResult: {
      updateBrief: (output, writer) => {
        const data = output as BriefData;
        writer.write({ type: "data-brief", data });
        return { brief: data.brief };
      },
      suggestIdeas: (output, writer) => {
        const data = output as IdeasData;
        writer.write({ type: "data-ideas", data });
        return { ideas: data.ideas };
      },
    },
  });
}

export { historyMessages } from "./run-chat";
