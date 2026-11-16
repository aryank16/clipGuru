import "server-only";
import { createUIMessageStream, createUIMessageStreamResponse, stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { chatModel } from "../ai/model";
import { ApiError } from "../api/errors";
import { briefUpdateSchema, mergeBrief, toBrief, type Brief, type BriefUpdate } from "../brief";
import type { ProjectsRepo } from "../projects/repo";
import { DEFAULT_TITLE, type ProjectRecord } from "../projects/types";
import type { ChatRepo } from "./repo";
import {
  CHAT_HISTORY_MAX,
  CHAT_LIMIT_PER_HOUR,
  type ChatMessageRecord,
  type Idea,
  type ToolResult,
} from "./types";

const HOUR_MS = 60 * 60 * 1000;

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

/** Earlier messages as model input. A note stands in for what a reply changed, so the model knows. */
export function historyMessages(history: ChatMessageRecord[]): ModelMessage[] {
  return history
    .filter((m) => m.status === "ok")
    .slice(-CHAT_HISTORY_MAX)
    .map((m): ModelMessage => {
      if (m.role === "user") return { role: "user", content: m.text };
      let note = "";
      if (m.toolResult?.brief) note += "\n[Updated the brief]";
      if (m.toolResult?.ideas) note += `\n[Suggested ideas: ${m.toolResult.ideas.map((i) => i.title).join("; ")}]`;
      return { role: "assistant", content: (m.text + note).trim() || "(no reply)" };
    });
}

/** Title follows the brief while the person hasn't named the video themselves. */
function nextTitle(project: { title: string }, before: Brief, after: Brief): string | undefined {
  if (!after.title || after.title === project.title) return undefined;
  if (project.title === DEFAULT_TITLE || project.title === before.title) return after.title;
  return undefined;
}

type Deps = { projects: ProjectsRepo; chat: ChatRepo; now?: () => Date };

/**
 * POST /api/projects/:id/chat on the idea step. Checks run before anything streams, so their
 * errors are plain JSON. The user's message is saved first; the reply is saved when the model is done,
 * whether or not the browser is still listening.
 */
export async function ideaChat(
  { projects, chat, now = () => new Date() }: Deps,
  { userId, projectId, rev, text }: { userId: string; projectId: string; rev: number; text: string },
): Promise<Response> {
  const project = await projects.get(userId, projectId);
  if (!project) throw new ApiError("NOT_FOUND");
  if (project.rev !== rev) throw new ApiError("REV_CONFLICT", undefined, { currentRev: project.rev });
  if (project.briefLockedAt) throw new ApiError("BRIEF_LOCKED", "The brief is locked once the storyboard exists.");

  const sent = await chat.countUserMessagesSince(userId, new Date(now().getTime() - HOUR_MS));
  if (sent >= CHAT_LIMIT_PER_HOUR) {
    throw new ApiError("LIMIT_REACHED", "You've sent a lot of messages this hour. Try again a little later.", {
      limit: "chat_per_hour",
      max: CHAT_LIMIT_PER_HOUR,
      retryAfterSec: 3600,
    });
  }

  const history = await chat.list(userId, projectId, "idea");
  const userMessage = await chat.insert({
    id: chat.newId(),
    projectId,
    userId,
    step: "idea",
    role: "user",
    text,
    toolResult: null,
    status: "ok",
    createdAt: now(),
  });
  await projects.markHasChat(userId, projectId);

  const fail = async (message = "The idea assistant is busy right now. Try again in a moment.") => {
    await chat.setStatus(userId, userMessage.id, "failed");
    return new ApiError("AI_UNAVAILABLE", message);
  };

  let model;
  try {
    model = chatModel();
  } catch (err) {
    throw await fail(err instanceof ApiError ? err.message : undefined);
  }

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
      current = latest;
    }
    throw new Error("brief kept changing");
  }

  const tools = {
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

  const result = streamText({
    model,
    system: systemPrompt(toBrief(project.brief), project.title),
    messages: [...historyMessages(history), { role: "user", content: text }],
    tools,
    stopWhen: stepCountIs(3),
    maxRetries: 2,
    temperature: 0.7,
  });

  // Wait for the first real output, so a Gemini outage is a 503 rather than a broken stream.
  const parts = result.fullStream[Symbol.asyncIterator]();
  const buffered: Awaited<ReturnType<typeof parts.next>>[] = [];
  for (;;) {
    let next;
    try {
      next = await parts.next();
    } catch (err) {
      console.error("[chat] model failed", err);
      throw await fail();
    }
    if (next.done) break;
    const t = next.value.type;
    if (t === "error") {
      console.error("[chat] model failed", next.value.error);
      throw await fail();
    }
    buffered.push(next);
    if (t === "text-delta" || t === "tool-result" || t === "tool-error" || t === "finish") break;
  }

  const assistantId = chat.newId();
  const stream = createUIMessageStream({
    async execute({ writer }) {
      writer.write({ type: "start", messageId: assistantId });
      let reply = "";
      let toolResult: ToolResult = null;
      let failed = false;

      const handle = (part: (typeof buffered)[number]["value"]) => {
        if (!part) return;
        switch (part.type) {
          case "text-start":
            writer.write({ type: "text-start", id: part.id });
            break;
          case "text-delta":
            reply += part.text;
            writer.write({ type: "text-delta", id: part.id, delta: part.text });
            break;
          case "text-end":
            writer.write({ type: "text-end", id: part.id });
            break;
          case "tool-result":
            if (part.toolName === "updateBrief") {
              const data = part.output as BriefData;
              toolResult = { ...toolResult, brief: data.brief };
              writer.write({ type: "data-brief", data });
            } else if (part.toolName === "suggestIdeas") {
              const data = part.output as IdeasData;
              toolResult = { ...toolResult, ideas: data.ideas };
              writer.write({ type: "data-ideas", data });
            }
            break;
          case "tool-error":
            console.error("[chat] tool failed", part.toolName, part.error);
            break;
          case "error":
            console.error("[chat] model failed mid-reply", part.error);
            failed = true;
            break;
        }
      };

      for (const b of buffered) if (!b.done) handle(b.value);
      try {
        for (;;) {
          const next = await parts.next();
          if (next.done) break;
          handle(next.value);
        }
      } catch (err) {
        console.error("[chat] stream broke", err);
        failed = true;
      }

      reply = reply.trim();
      if (!reply && !toolResult) {
        await chat.setStatus(userId, userMessage.id, "failed");
        writer.write({ type: "error", errorText: "The idea assistant didn't answer. Try again." });
        return;
      }
      await chat.insert({
        id: assistantId,
        projectId,
        userId,
        step: "idea",
        role: "assistant",
        text: reply,
        toolResult,
        status: failed ? "failed" : "ok",
        createdAt: now(),
      });
      writer.write({ type: "finish" });
    },
    onError: (err) => {
      console.error("[chat] reply failed", err);
      return "The idea assistant stopped halfway. Try again.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
