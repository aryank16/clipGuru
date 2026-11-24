import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { chatModel } from "../ai/model";
import { ApiError } from "../api/errors";
import { lengthRange, lengthText, targetSecondsFor, type Brief } from "../brief";
import type { StoryboardWriter } from "./service";
import { resolveIcon, SUGGESTED_ICONS } from "./icons";
import {
  cap3d,
  flatten3d,
  MAX_3D_NARRATION,
  MAX_3D_SCENES,
  PRESETS_3D,
  repairCues,
  SCENE_TYPES,
  storyboardSchema,
  WORDS_PER_SECOND,
  wordCount,
  type Preset3D,
  type Scene,
  type Storyboard,
} from "./types";

/**
 * Gemini writes the script and the storyboard together (ported from the prototype's pipeline/gemini.ts).
 * Gemini's structured output handles unions poorly, so it fills one flat scene shape that is mapped
 * to typed scenes here.
 */
const rawItem = z.object({ icon: z.string().optional(), label: z.string(), cue: z.string() });
const rawScene = z.object({
  type: z.enum(SCENE_TYPES),
  narration: z.string(),
  heading: z.string(),
  subtitle: z.string().optional(),
  icon: z.string().optional(),
  centerLabel: z.string().optional(),
  value: z.string().optional(),
  values: z.array(z.number().int()).optional(),
  target: z.number().int().optional(),
  preset: z.string().optional(),
  items: z.array(rawItem).optional(),
});
const rawStoryboard = z.object({ title: z.string(), scenes: z.array(rawScene) });
type RawScene = z.infer<typeof rawScene>;

const SYSTEM = `You are the writer for ClipGuru, which makes short vertical educational explainer videos (Instagram Reels).
You write the voiceover script and the storyboard together. The style is a calm, minimalist, flat motion-graphics explainer:
line icons, simple diagrams that draw on, a few words of on-screen text. No clutter.

Rules for the script:
- British English spelling and phrasing. Spoken by a British narrator. Warm, clear, curious, not salesy.
- Total narration length is given in the request (the narrator speaks about 2.5 words per second). Short sentences. No emojis, no hashtags, no stage directions.
- Write numbers as words in narration (e.g. "ninety seven percent"), but use digits in on-screen "value".
- Open with a hook in the first sentence. End with a one-line takeaway.

Rules for the storyboard (5 to 9 scenes, fewer for short videos):
- Scene 1 must be "title" (heading = video title, subtitle = short line, icon).
- Last scene should be "summary" (heading, items = 2-4 short points; put each point's text in "label").
- Scene types:
  - "title": heading, subtitle, icon.
  - "stat": value (short, e.g. "97%", "8 min", "1.5 bn"), heading = label under the number (max 8 words), icon. items = one item whose cue is the word where the number is spoken.
  - "focus": heading (max 4 words), icon = the hero icon, items = 0-3 callouts (label max 3 words, no icon).
  - "iconList": heading, items = 2-4 (icon + label max 4 words).
  - "flow": heading, items = 2-4 sequential steps (icon + label max 3 words).
  - "cycle": heading, centerLabel (max 4 words), items = 3-5 steps of a loop (icon + label, one word ideally).
  - "summary": heading, items = 2-4 points (label max 5 words).
  - "arraySearch": an animated sorted row of numbers searched with binary search. Use it only when the topic is searching
    a sorted list. values = 7 to 11 sorted distinct integers under 100, target = one of the values (pick one that takes
    3 checks). heading. items = one item per comparison, in order (label = e.g. "Check 23"), each cue = the word in the
    narration where that comparison is said.
  - "scene3d": a short cinematic 3D shot, the most striking scene type. Use it at most twice per video (never more), only where
    one of these presets truly shows the idea. Its narration must be short: 1-2 sentences, at most 35 words. heading (max 5 words), items = 1-4 (label max 3 words, no icon), in the order
    they happen; each item's cue is the word where that beat happens. Presets:
    Ready-made shots (items appear in the shot):
    "impact" (an object smashes through 1-4 panels: force, momentum, breaking barriers, layers of defence),
    "orbit" (1-4 bodies circling a centre: planets, electrons, satellites), "globe" (a turning Earth with 1-4 places marked
    and linked: geography, spread, trade, travel), "molecule" (1-4 atoms bonding to a centre atom: chemistry, parts joining),
    "stack" (1-4 blocks dropping into a tower: gravity, building up, layers),
    "highway" (a car speeding down a highway; time slows on item 1 as a bullet flies in, it passes through the car on item 2,
    then an X-ray view shows its slanted path and time speeds up on item 3: relative motion, speed, frames of reference.
    Exactly 3 items).
    Objects from the 3D model library (the object reacts on each item):
    "dna" (genes, heredity; the helix lights up), "cell" (biology; nucleus, mitochondria, ribosomes arrive in that order),
    "heart" (heart, blood, health, love; it beats harder), "brain" (mind, learning, memory, AI; regions light up),
    "rocket" (space, launches, startups taking off; engines ignite on item 1, lift-off on the last item), "planet" (space,
    Saturn, astronomy; rings open, then a moon), "bulb" (ideas, electricity, invention; it switches on and brightens),
    "battery" (energy, charging, stamina; it fills in steps), "gears" (machines, systems, teamwork; one gear per item),
    "coins" (money, saving, investing, growth; one taller stack per item), "phone" (apps, social media, notifications,
    screen time; a card pops out per item), "magnet" (magnetism, attraction; the field appears, iron balls fly in),
    "volcano" (geology, eruptions, pressure building; it erupts on item 2, or item 1 if only one), "tree" (growth, nature,
    plants; it grows, leaves fill out, fruit on the last item), "lock" (security, privacy, passwords, encryption; a shield
    forms, it opens on the last item), "hourglass" (time, deadlines, patience; with 3+ items it flips on item 2).
- Each scene's narration is 1-3 sentences (12-40 words) and must talk about exactly what that scene shows.
  Never move on to the next idea inside the same scene: if the narration changes subject, start a new scene.
- Every item has a "cue": ONE word copied exactly from that scene's narration (it MUST appear in that narration), spoken at
  the moment the item should appear. Cues must appear in the narration in the same order as the items.
- Icons: lucide icon names in PascalCase. Prefer: ${SUGGESTED_ICONS.join(", ")}.
- Headings and labels: Sentence case, no full stop.
- Never write anything hateful, sexual or dangerous, or personal medical, legal or financial advice.`;

const clip = (s: string | undefined, max: number) => (s ?? "").trim().slice(0, max);

/** The model's preset name, or "orbit" (the safest all-rounder) when it wrote something unknown. */
function preset3d(name: string | undefined): Preset3D {
  const p = (name ?? "").trim().toLowerCase();
  return (PRESETS_3D as readonly string[]).includes(p) ? (p as Preset3D) : "orbit";
}

/** One flat scene from Gemini → a typed scene. Returns null when it can't be made valid. */
export function toScene(r: RawScene): Scene | null {
  const items = (r.items ?? []).filter((i) => i.label?.trim());
  const withIcons = items.map((i) => ({ icon: resolveIcon(i.icon), label: clip(i.label, 60), cue: clip(i.cue, 40) || "x" }));
  const narration = clip(r.narration, 600);
  const heading = clip(r.heading, 60) || "Untitled";
  let scene: Scene;
  switch (r.type) {
    case "title":
      scene = { type: "title", narration, title: clip(r.heading, 80) || "Untitled", subtitle: clip(r.subtitle, 120) || undefined, icon: resolveIcon(r.icon) };
      break;
    case "stat":
      scene = { type: "stat", narration, value: clip(r.value, 16) || "?", label: clip(r.heading, 80) || "Untitled", icon: resolveIcon(r.icon), cue: items[0]?.cue };
      break;
    case "focus":
      scene = { type: "focus", narration, heading, icon: resolveIcon(r.icon), callouts: items.slice(0, 3).map((i) => ({ label: clip(i.label, 40), cue: clip(i.cue, 40) || "x" })) };
      break;
    case "iconList":
      if (!withIcons.length) return null;
      scene = { type: "iconList", narration, heading, items: withIcons.slice(0, 4) };
      break;
    case "flow":
      if (!withIcons.length) return null;
      scene = { type: "flow", narration, heading, steps: withIcons.slice(0, 4) };
      break;
    case "cycle":
      if (withIcons.length < 2) return null;
      scene = { type: "cycle", narration, heading, centerLabel: clip(r.centerLabel, 40) || undefined, steps: withIcons.slice(0, 6) };
      break;
    case "arraySearch": {
      const values = [...new Set((r.values ?? []).map(Math.round))].sort((a, b) => a - b).slice(0, 11);
      if (values.length < 3) return null;
      const target = values.includes(r.target ?? NaN) ? r.target! : values[Math.floor(values.length * 0.7)];
      scene = { type: "arraySearch", narration, heading, values, target, steps: items.slice(0, 6).map((i) => ({ cue: clip(i.cue, 40) || "x" })) };
      break;
    }
    case "summary":
    default:
      if (!items.length) return null;
      scene = { type: "summary", narration, heading, points: items.slice(0, 4).map((i) => ({ text: clip(i.label, 60), cue: clip(i.cue, 40) || "x" })) };
      break;
    case "scene3d":
      if (!items.length) return null;
      scene = {
        type: "scene3d",
        narration,
        heading,
        preset: preset3d(r.preset),
        items: items.slice(0, 4).map((i) => ({ label: clip(i.label, 40), cue: clip(i.cue, 40) || "x" })),
      };
  }
  if (!narration) return null;
  const fixed = repairCues(scene);
  return storyboardSchema.shape.scenes.element.safeParse(fixed).success ? fixed : null;
}

/** A typed scene back to the flat shape, so Gemini sees what it would write. */
export function toRaw(s: Scene): RawScene {
  switch (s.type) {
    case "title":
      return { type: s.type, narration: s.narration, heading: s.title, subtitle: s.subtitle, icon: s.icon };
    case "stat":
      return { type: s.type, narration: s.narration, heading: s.label, value: s.value, icon: s.icon, items: s.cue ? [{ label: s.value, cue: s.cue }] : [] };
    case "focus":
      return { type: s.type, narration: s.narration, heading: s.heading, icon: s.icon, items: s.callouts };
    case "iconList":
      return { type: s.type, narration: s.narration, heading: s.heading, items: s.items };
    case "flow":
      return { type: s.type, narration: s.narration, heading: s.heading, items: s.steps };
    case "cycle":
      return { type: s.type, narration: s.narration, heading: s.heading, centerLabel: s.centerLabel, items: s.steps };
    case "summary":
      return { type: s.type, narration: s.narration, heading: s.heading, items: s.points.map((p) => ({ label: p.text, cue: p.cue })) };
    case "arraySearch":
      return { type: s.type, narration: s.narration, heading: s.heading, values: s.values, target: s.target, items: s.steps.map((p) => ({ label: "Check", cue: p.cue })) };
    case "scene3d":
      return { type: s.type, narration: s.narration, heading: s.heading, preset: s.preset, items: s.items };
  }
}

function lengthRule(brief: Brief) {
  const words = (sec: number) => Math.round(sec * WORDS_PER_SECOND);
  if (brief.length === "auto") {
    // Auto: the writer sizes it to the idea, from a quick 30 s up to 90 s.
    const min = words(30);
    const max = words(lengthRange(brief).max);
    return {
      min,
      max,
      text: `Size the video to the idea: a simple topic can be 30 to 45 seconds, a richer one up to 90. The narration must total ${min} to ${max} words.`,
    };
  }
  const range = lengthRange(brief);
  const seconds = targetSecondsFor(brief);
  const min = Math.max(words(range.min), Math.round(words(seconds) * 0.9));
  const max = Math.min(words(range.max), Math.round(words(seconds) * 1.1));
  const scenes = seconds <= 30 ? "Use 3 or 4 scenes. " : seconds <= 50 ? "Use 4 to 6 scenes. " : "";
  return { min, max, text: `${scenes}The narration must total ${min} to ${max} words (about ${seconds} seconds).` };
}

async function ask(prompt: string): Promise<z.infer<typeof rawStoryboard>> {
  try {
    const { output } = await generateText({
      model: chatModel(),
      system: SYSTEM,
      prompt,
      output: Output.object({ schema: rawStoryboard, name: "storyboard" }),
      temperature: 0.8,
      maxRetries: 1, // each try already walks the backup models
    });
    return output;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[storyboard] Gemini failed", err);
    throw new ApiError("AI_UNAVAILABLE", "The storyboard writer is busy right now. Try again in a moment.");
  }
}

function build(topic: string, raw: z.infer<typeof rawStoryboard>): Storyboard {
  const scenes = cap3d(raw.scenes.map(toScene).filter((s): s is Scene => s !== null));
  return { topic: topic.slice(0, 200), title: clip(raw.title, 120) || topic.slice(0, 120) || "Untitled", scenes };
}

function briefText(b: Brief): string {
  return [
    `Topic: ${b.title}`,
    b.audience && `Audience: ${b.audience}`,
    b.keyPoints.length && `Key points, in this order:\n${b.keyPoints.map((p) => `- ${p}`).join("\n")}`,
    b.angle && `Angle or visual idea: ${b.angle}`,
    b.tone && `Tone: ${b.tone}`,
    b.notes && `Notes: ${b.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Version 1 from the brief. Retries once or twice when the length is off. */
export async function writeStoryboard(brief: Brief): Promise<Storyboard> {
  const rule = lengthRule(brief);
  const base = `${briefText(brief)}\n\n${rule.text}`;
  let prompt = base;
  let best: Storyboard | null = null;
  const started = Date.now();
  // A retry only while there is time for it inside the request (each call takes about 10 to 20 s).
  for (let attempt = 0; attempt < 3 && (attempt === 0 || Date.now() - started < 40_000); attempt++) {
    const sb = build(brief.title, await ask(prompt));
    const n = wordCount(sb);
    const ok = sb.scenes.length >= 3 && sb.scenes[0]?.type === "title";
    if (ok && (!best || Math.abs(n - (rule.min + rule.max) / 2) < Math.abs(wordCount(best) - (rule.min + rule.max) / 2))) best = sb;
    if (ok && n >= rule.min - 5 && n <= rule.max + 5) return sb;
    prompt = `${base}\nYour last draft had ${n} words of narration${ok ? "" : " and did not start with a title scene"}. ${rule.text}`;
  }
  if (best) return best;
  throw new ApiError("AI_UNAVAILABLE", "The storyboard writer didn't produce a usable draft. Try again.");
}

/** The whole storyboard with a change applied (chat revisions). Keeps scenes the change doesn't touch. */
export async function reviseStoryboard(
  current: Storyboard,
  instruction: string,
  length: Pick<Brief, "length"> = { length: "auto" },
): Promise<Storyboard> {
  const range = lengthRange(length);
  const prompt = [
    `Here is the current storyboard as JSON:`,
    JSON.stringify({ title: current.title, scenes: current.scenes.map(toRaw) }),
    ``,
    `Apply this change and return the whole storyboard: ${instruction}`,
    `Change only what the request needs; copy every other scene exactly. Keep the total length ${lengthText(length)} `
      + `(${Math.round(range.min * WORDS_PER_SECOND)} to ${Math.round(range.max * WORDS_PER_SECOND)} words) unless the request is about length.`,
  ].join("\n");
  const sb = build(current.topic, await ask(prompt));
  if (sb.scenes.length < 3) throw new ApiError("AI_UNAVAILABLE", "That change didn't come out right. Try saying it another way.");
  return sb;
}

/** A new take on one scene, keeping its place in the story. */
export async function rewriteScene(current: Storyboard, index: number, instruction?: string): Promise<Scene> {
  const prompt = [
    `Here is the current storyboard as JSON:`,
    JSON.stringify({ title: current.title, scenes: current.scenes.map(toRaw) }),
    ``,
    `Rewrite scene ${index + 1} only (a fresh take: different wording and visual, same idea and about the same length).`,
    instruction ? `The person asks: ${instruction}` : "",
    `Return the whole storyboard with only scene ${index + 1} changed.`,
  ].join("\n");
  const sb = build(current.topic, await ask(prompt));
  const scene = sb.scenes[index] ?? sb.scenes.find((s, i) => JSON.stringify(s) !== JSON.stringify(current.scenes[i]));
  if (!scene) throw new ApiError("AI_UNAVAILABLE", "That scene didn't come out right. Try again.");
  // The rest of the video may already use up the 3D scenes.
  const others = current.scenes.filter((s, i) => i !== index && s.type === "scene3d").length;
  return others >= MAX_3D_SCENES || (scene.type === "scene3d" && scene.narration.length > MAX_3D_NARRATION) ? flatten3d(scene) : scene;
}

export const geminiWriter: StoryboardWriter = {
  write: writeStoryboard,
  revise: reviseStoryboard,
  rewriteScene,
};
