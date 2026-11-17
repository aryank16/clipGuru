import "server-only";
import { createGoogle } from "@ai-sdk/google";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";
import { ApiError } from "../api/errors";
import { aiDriver, env } from "../env";
import { fakeChatModel } from "./fake-model";
import { withFallback } from "./fallback";

/**
 * The chat model: Gemini Flash (the key is free tier, so no Pro models), falling back to the
 * GEMINI_FALLBACK_MODELS in turn while it is busy; or the scripted fake in tests.
 */
export function chatModel(): LanguageModel {
  if (aiDriver() === "fake") return fakeChatModel;
  const { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODELS } = env();
  if (!GEMINI_API_KEY) {
    console.error("[ai] GEMINI_API_KEY is not set");
    throw new ApiError("AI_UNAVAILABLE", "The idea assistant isn't set up yet.");
  }
  const google = createGoogle({ apiKey: GEMINI_API_KEY });
  const ids = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS.split(",").map((m) => m.trim())].filter(
    (m, i, all) => m && all.indexOf(m) === i,
  );
  return withFallback(ids.map((id) => google(id) as LanguageModelV4));
}
