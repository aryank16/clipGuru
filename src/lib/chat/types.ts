import type { Brief } from "../brief";

/** Chat messages (API Design → ChatMessage). The storyboard step joins in F8. */
export const CHAT_STEPS = ["idea", "storyboard"] as const;
export type ChatStep = (typeof CHAT_STEPS)[number];

export type Idea = { title: string; hook: string };

/** What a reply changed, so the UI can show it again after a reload. */
export type ToolResult = { brief?: Brief; ideas?: Idea[] } | null;

export type ChatMessageRecord = {
  id: string;
  projectId: string;
  userId: string;
  step: ChatStep;
  role: "user" | "assistant";
  text: string;
  toolResult: ToolResult;
  status: "ok" | "failed";
  createdAt: Date;
};

export type ChatMessage = {
  id: string;
  step: ChatStep;
  role: "user" | "assistant";
  text: string;
  toolResult: ToolResult;
  status: "ok" | "failed";
  createdAt: string;
};

export function toChatMessage(r: ChatMessageRecord): ChatMessage {
  return {
    id: r.id,
    step: r.step,
    role: r.role,
    text: r.text,
    toolResult: r.toolResult,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

export const CHAT_TEXT_MAX = 2000;
/** API Design → rate limits: 60 chat messages per user per hour. */
export const CHAT_LIMIT_PER_HOUR = 60;
/** How many earlier messages the model sees. Idea chats are short. */
export const CHAT_HISTORY_MAX = 40;
