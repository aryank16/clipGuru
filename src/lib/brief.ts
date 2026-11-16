import { z } from "zod";

/**
 * The video brief (API Design → Brief). The idea chat fills it in; the person can edit any field.
 * Shared by the server and the brief panel.
 */
export const BRIEF_LIMITS = { title: 120, audience: 160, point: 200, points: 6, angle: 300, tone: 60, notes: 1000 };

/** Videos are auto-sized to 60–90 seconds; this is the midpoint the storyboard aims for. */
export const DEFAULT_TARGET_SECONDS = 75;

/** Preset tones shown as chips. Any short text works. */
export const TONE_PRESETS = ["Calm and clear", "Friendly and upbeat", "Serious and factual"] as const;

export type Brief = {
  title: string;
  audience: string;
  keyPoints: string[];
  angle: string;
  tone: string;
  targetSeconds: number;
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
  targetSeconds: z.number().int().min(60).max(90),
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
});
export type BriefUpdate = z.infer<typeof briefUpdateSchema>;

export function emptyBrief(): Brief {
  return { title: "", audience: "", keyPoints: [], angle: "", tone: "", targetSeconds: DEFAULT_TARGET_SECONDS };
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
  const seconds = typeof r.targetSeconds === "number" && r.targetSeconds >= 60 && r.targetSeconds <= 90;
  return {
    title: str(r.title, BRIEF_LIMITS.title),
    audience: str(r.audience, BRIEF_LIMITS.audience),
    keyPoints: points.map((p) => p.slice(0, BRIEF_LIMITS.point)),
    angle: str(r.angle, BRIEF_LIMITS.angle),
    tone: str(r.tone, BRIEF_LIMITS.tone),
    targetSeconds: seconds ? Math.round(r.targetSeconds as number) : base.targetSeconds,
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
  const points = update.keyPoints?.map((p) => p.trim()).filter(Boolean);
  if (points?.length) next.keyPoints = points;
  return next;
}

/** The storyboard needs at least a title and one key point (API Design → BRIEF_INCOMPLETE). */
export function briefComplete(b: Brief): boolean {
  return b.title.trim().length > 0 && b.keyPoints.some((p) => p.trim().length > 0);
}
