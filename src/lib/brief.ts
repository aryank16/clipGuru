import { z } from "zod";

/**
 * The video brief (API Design → Brief). The idea chat fills it in; the person can edit any field.
 * Shared by the server and the brief panel.
 */
export const BRIEF_LIMITS = { title: 120, audience: 160, point: 200, points: 6, angle: 300, tone: 60, notes: 1000 };

/** Kept for older briefs; the length choice below decides the real target. */
export const DEFAULT_TARGET_SECONDS = 75;

/**
 * The length the person picks in the brief. Auto lets ClipGuru size the video to the idea
 * (anywhere up to 90 s); the other three are fixed ranges.
 */
export const VIDEO_LENGTHS = {
  auto: { label: "Auto", min: 15, max: 90 },
  short: { label: "0–30 s", min: 10, max: 30 },
  medium: { label: "30–60 s", min: 30, max: 60 },
  long: { label: "60–90 s", min: 60, max: 90 },
} as const;
export type VideoLength = keyof typeof VIDEO_LENGTHS;
export const VIDEO_LENGTH_IDS = Object.keys(VIDEO_LENGTHS) as VideoLength[];
export const DEFAULT_LENGTH: VideoLength = "auto";

/** The seconds a storyboard may run for this brief (the warning shows outside it). */
export function lengthRange(b: Pick<Brief, "length">): { min: number; max: number } {
  const { min, max } = VIDEO_LENGTHS[b.length] ?? VIDEO_LENGTHS.auto;
  return { min, max };
}

/** The seconds the storyboard writer aims for with a fixed range (Auto lets the writer choose). */
export function targetSecondsFor(b: Pick<Brief, "length">): number {
  return { auto: 60, short: 25, medium: 45, long: 75 }[b.length] ?? 60;
}

/** "0–30 s" style text for a range, used in prompts and warnings. */
export function lengthText(b: Pick<Brief, "length">): string {
  const { min, max } = lengthRange(b);
  if (b.length === "auto") return `up to ${max} seconds, sized to the idea`;
  if (b.length === "short") return `under ${max} seconds`;
  return `${min} to ${max} seconds`;
}

/** Preset tones shown as chips. Any short text works. */
export const TONE_PRESETS = ["Calm and clear", "Friendly and upbeat", "Serious and factual"] as const;

export type Brief = {
  title: string;
  audience: string;
  keyPoints: string[];
  angle: string;
  tone: string;
  targetSeconds: number;
  length: VideoLength;
  notes?: string;
};

const text = (max: number) => z.string().trim().max(max);

/** A full brief as stored and as sent by the panel. */
export const briefSchema = z.object({
  title: text(BRIEF_LIMITS.title),
  audience: text(BRIEF_LIMITS.audience),
  keyPoints: z.array(text(BRIEF_LIMITS.point)).max(BRIEF_LIMITS.points),
  angle: text(BRIEF_LIMITS.angle),
  tone: text(BRIEF_LIMITS.tone),
  targetSeconds: z.number().int().min(10).max(90),
  length: z.enum(["auto", "short", "medium", "long"]).default(DEFAULT_LENGTH),
  notes: text(BRIEF_LIMITS.notes).optional(),
});

/** What the chat model may change in one reply: any subset of the editable fields. */
export const briefUpdateSchema = z.object({
  title: text(BRIEF_LIMITS.title).optional().describe("Short working title for the video, at most 8 words."),
  audience: text(BRIEF_LIMITS.audience).optional().describe("Who the video is for, e.g. 'Students aged 12 to 16'."),
  keyPoints: z
    .array(text(BRIEF_LIMITS.point))
    .max(BRIEF_LIMITS.points)
    .optional()
    .describe("The 2 to 5 things a viewer should take away, in teaching order. Replaces the whole list."),
  angle: text(BRIEF_LIMITS.angle)
    .optional()
    .describe("The hook or visual metaphor that carries the explanation, e.g. 'Follow one raindrop'."),
  tone: text(BRIEF_LIMITS.tone).optional().describe("Tone of the narration in a few words, e.g. 'Calm and clear'."),
  notes: text(BRIEF_LIMITS.notes).optional().describe("Anything else the storyboard writer should know."),
  length: z
    .enum(["auto", "short", "medium", "long"])
    .optional()
    .describe("Only when the person asks for a length: short = under 30 s, medium = 30 to 60 s, long = 60 to 90 s, auto = sized to the idea."),
});
export type BriefUpdate = z.infer<typeof briefUpdateSchema>;

export function emptyBrief(): Brief {
  return { title: "", audience: "", keyPoints: [], angle: "", tone: "", targetSeconds: DEFAULT_TARGET_SECONDS, length: DEFAULT_LENGTH };
}

/** Reads whatever is stored (older or partial briefs included) into a full Brief. */
export function toBrief(raw: unknown): Brief {
  const base = emptyBrief();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const points = Array.isArray(r.keyPoints)
    ? r.keyPoints.filter((p): p is string => typeof p === "string").slice(0, BRIEF_LIMITS.points)
    : [];
  const seconds = typeof r.targetSeconds === "number" && r.targetSeconds >= 10 && r.targetSeconds <= 90;
  const length = typeof r.length === "string" && r.length in VIDEO_LENGTHS ? (r.length as VideoLength) : DEFAULT_LENGTH;
  return {
    title: str(r.title, BRIEF_LIMITS.title),
    audience: str(r.audience, BRIEF_LIMITS.audience),
    keyPoints: points.map((p) => p.slice(0, BRIEF_LIMITS.point)),
    angle: str(r.angle, BRIEF_LIMITS.angle),
    tone: str(r.tone, BRIEF_LIMITS.tone),
    targetSeconds: seconds ? Math.round(r.targetSeconds as number) : base.targetSeconds,
    length,
    ...(typeof r.notes === "string" && r.notes ? { notes: r.notes.slice(0, BRIEF_LIMITS.notes) } : {}),
  };
}

/** Applies a chat update. Blank strings and empty points are dropped so the model can't wipe a field by accident. */
export function mergeBrief(current: Brief, update: BriefUpdate): Brief {
  const next: Brief = { ...current, keyPoints: [...current.keyPoints] };
  for (const key of ["title", "audience", "angle", "tone", "notes"] as const) {
    const v = update[key]?.trim();
    if (v) next[key] = v;
  }
  if (update.length) next.length = update.length;
  const points = update.keyPoints?.map((p) => p.trim()).filter(Boolean);
  if (points?.length) next.keyPoints = points;
  return next;
}

/** The storyboard needs at least a title and one key point (API Design → BRIEF_INCOMPLETE). */
export function briefComplete(b: Brief): boolean {
  return b.title.trim().length > 0 && b.keyPoints.some((p) => p.trim().length > 0);
}
