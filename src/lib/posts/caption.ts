import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { chatModel } from "../ai/model";
import { ApiError } from "../api/errors";
import type { Storyboard } from "../storyboard/types";
import { CAPTION_MAX, cleanHashtag, fullCaption } from "./types";

export type CaptionSuggestion = { caption: string; hashtags: string[] };

/** Marker the fake model looks for (AI_DRIVER=fake). */
export const CAPTION_SYSTEM_TAG = "You write Instagram captions for ClipGuru";

const SYSTEM = `${CAPTION_SYSTEM_TAG}, which makes short vertical educational explainer videos (Reels).
Write the caption for one Reel from its script.
- British English. Warm, clear and curious; never salesy or clickbait. No emojis unless the tone asks for them.
- Open with a one-line hook (a question or a surprising fact from the script) that makes people want to watch.
- Then 1 to 3 short sentences on what the viewer will learn. Use a line break between the hook and the rest.
- End with a soft call to action on its own line (for example "Follow for more short explainers.").
- At most 600 characters. Do not put hashtags in the caption.
- hashtags: 5 to 10 relevant tags, without "#", no spaces, a mix of specific and broad (e.g. "watercycle", "science", "learnsomethingnew").
- Never write anything hateful, sexual or dangerous, or personal medical, legal or financial advice.`;

const schema = z.object({ caption: z.string(), hashtags: z.array(z.string()) });

function scriptOf(sb: Storyboard): string {
  return sb.scenes.map((s, i) => `${i + 1}. ${s.narration}`).join("\n");
}

/** POST /api/projects/:id/caption: a caption and hashtags from the storyboard. Nothing is saved. */
export async function suggestCaption(sb: Storyboard, opts: { durationSec?: number | null; tone?: string } = {}): Promise<CaptionSuggestion> {
  const prompt = [
    `Video title: ${sb.title}`,
    opts.durationSec ? `Length: ${Math.round(opts.durationSec)} seconds` : "",
    opts.tone ? `Tone wanted: ${opts.tone.slice(0, 200)}` : "",
    `Script:`,
    scriptOf(sb),
  ]
    .filter(Boolean)
    .join("\n");
  let out: z.infer<typeof schema>;
  try {
    ({ output: out } = await generateText({
      model: chatModel(),
      system: SYSTEM,
      prompt,
      output: Output.object({ schema, name: "caption" }),
      temperature: 0.9,
      maxRetries: 1,
    }));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[caption] Gemini failed", err);
    throw new ApiError("AI_UNAVAILABLE", "The caption writer is busy right now. Try again in a moment.");
  }
  const seen = new Set<string>();
  const hashtags = out.hashtags
    .map(cleanHashtag)
    .filter((h) => h && !seen.has(h.toLowerCase()) && seen.add(h.toLowerCase()))
    .slice(0, 10);
  // The model is asked to leave hashtags out of the caption; strip any trailing ones it adds anyway.
  let caption = out.caption.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, "").trim();
  const room = CAPTION_MAX - fullCaption("", hashtags).length - 2;
  if (caption.length > room) caption = caption.slice(0, room).trimEnd();
  if (!caption) throw new ApiError("AI_UNAVAILABLE", "The caption didn't come out right. Try again.");
  return { caption, hashtags };
}
