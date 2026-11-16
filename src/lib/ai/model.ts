import "server-only";
import { createGoogle } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { ApiError } from "../api/errors";
import { aiDriver, env } from "../env";
import { fakeChatModel } from "./fake-model";

/** The chat model: Gemini Flash (the key is free tier, so no Pro models), or the scripted fake in tests. */
export function chatModel(): LanguageModel {
  if (aiDriver() === "fake") return fakeChatModel;
  const { GEMINI_API_KEY, GEMINI_MODEL } = env();
  if (!GEMINI_API_KEY) {
    console.error("[ai] GEMINI_API_KEY is not set");
    throw new ApiError("AI_UNAVAILABLE", "The idea assistant isn't set up yet.");
  }
  return createGoogle({ apiKey: GEMINI_API_KEY })(GEMINI_MODEL);
}
