import "server-only";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type ModelMessage,
  type ToolSet,
  type UIMessageStreamWriter,
} from "ai";
import { chatModel } from "../ai/model";
import { ApiError } from "../api/errors";
import type { ProjectRecord } from "../projects/types";
import type { ProjectsRepo } from "../projects/repo";
import type { ChatRepo } from "./repo";
import { CHAT_HISTORY_MAX, CHAT_LIMIT_PER_HOUR, type ChatMessageRecord, type ChatStep, type ToolResult } from "./types";

const HOUR_MS = 60 * 60 * 1000;

export type ChatDeps = { projects: ProjectsRepo; chat: ChatRepo; now?: () => Date };
export type ChatInput = { userId: string; projectId: string; rev: number; text: string };

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
      if (m.toolResult?.storyboard) note += `\n[Saved storyboard version ${m.toolResult.storyboard.version}]`;
      return { role: "assistant", content: (m.text + note).trim() || "(no reply)" };
    });
}

/** A tool's output → the data part the browser gets and what the saved reply remembers. */
type ToolOutputHandler = (output: unknown, writer: UIMessageStreamWriter) => ToolResult;

type Step = {
  step: ChatStep;
  /** Step-specific checks on the project, before anything is saved. */
  check(project: ProjectRecord): void;
  system(project: ProjectRecord): string;
  /** Tools for this reply; they can move the project forward. */
  tools(project: ProjectRecord): ToolSet;
  onToolResult: Record<string, ToolOutputHandler>;
  busyMessage: string;
};

/**
 * POST /api/projects/:id/chat for one step. Checks run before anything streams, so their errors are
 * plain JSON. The user's message is saved first; the reply is saved when the model is done, whether
 * or not the browser is still listening.
 */
export async function runChat(
  { projects, chat, now = () => new Date() }: ChatDeps,
  { userId, projectId, rev, text }: ChatInput,
  s: Step,
): Promise<Response> {
  const project = await projects.get(userId, projectId);
  if (!project) throw new ApiError("NOT_FOUND");
  if (project.rev !== rev) throw new ApiError("REV_CONFLICT", undefined, { currentRev: project.rev });
  s.check(project);

  const sent = await chat.countUserMessagesSince(userId, new Date(now().getTime() - HOUR_MS));
  if (sent >= CHAT_LIMIT_PER_HOUR) {
    throw new ApiError("LIMIT_REACHED", "You've sent a lot of messages this hour. Try again a little later.", {
      limit: "chat_per_hour",
      max: CHAT_LIMIT_PER_HOUR,
      retryAfterSec: 3600,
    });
  }

  const history = await chat.list(userId, projectId, s.step);
  const userMessage = await chat.insert({
    id: chat.newId(),
    projectId,
    userId,
    step: s.step,
    role: "user",
    text,
    toolResult: null,
    status: "ok",
    createdAt: now(),
  });
  await projects.markHasChat(userId, projectId);

  const fail = async (message = s.busyMessage) => {
    await chat.setStatus(userId, userMessage.id, "failed");
    return new ApiError("AI_UNAVAILABLE", message);
  };

  let model;
  try {
    model = chatModel();
  } catch (err) {
    throw await fail(err instanceof ApiError ? err.message : undefined);
  }

  const result = streamText({
    model,
    system: s.system(project),
    messages: [...historyMessages(history), { role: "user", content: text }],
    tools: s.tools(project),
    stopWhen: stepCountIs(3),
    maxRetries: 1, // each try already walks the backup models
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
          case "tool-result": {
            const saved = s.onToolResult[part.toolName]?.(part.output, writer);
            if (saved) toolResult = { ...toolResult, ...saved };
            break;
          }
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
        writer.write({ type: "error", errorText: "The assistant didn't answer. Try again." });
        return;
      }
      await chat.insert({
        id: assistantId,
        projectId,
        userId,
        step: s.step,
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
      return "The assistant stopped halfway. Try again.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
