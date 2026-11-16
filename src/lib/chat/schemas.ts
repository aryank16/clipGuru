import { z } from "zod";
import { CHAT_TEXT_MAX } from "./types";

export const chatBody = z
  .object({
    rev: z.number().int().min(0),
    step: z.enum(["idea", "storyboard"]),
    text: z
      .string()
      .trim()
      .min(1, "Type a message first.")
      .max(CHAT_TEXT_MAX, `Keep messages under ${CHAT_TEXT_MAX} characters.`),
  })
  .strict();

export const messagesQuery = z.object({ step: z.enum(["idea", "storyboard"]) });
