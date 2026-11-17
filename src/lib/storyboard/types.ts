import { z } from "zod";

/**
 * Storyboards (API Design → StoryboardVersion; the prototype's Storyboard type). Gemini writes the
 * narration and the scenes together. Every visual item appears on a "cue" word of its scene's narration.
 * Shared by the server and the Storyboard step.
 */
export const SCENE_TYPES = ["title", "stat", "focus", "iconList", "flow", "cycle", "summary", "arraySearch"] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const SCENE_LABELS: Record<SceneType, string> = {
  title: "Title",
  stat: "Stat",
  focus: "Focus",
  iconList: "Icon list",
  flow: "Flow",
  cycle: "Cycle",
  summary: "Summary",
  arraySearch: "Search",
};

const text = (max: number) => z.string().trim().min(1).max(max);
const icon = z.string().trim().min(1).max(40);
const cue = z.string().trim().min(1).max(40);
const narration = z.string().trim().min(1, "Narration can't be empty.").max(600, "Keep a scene under 600 characters.");
const cueItem = z.object({ icon, label: text(60), cue });

export const sceneSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("title"), narration, title: text(80), subtitle: text(120).optional(), icon: icon.optional() }),
  z.object({
    type: z.literal("stat"),
    narration,
    value: text(16),
    label: text(80),
    icon: icon.optional(),
    cue: cue.optional(),
  }),
  z.object({
    type: z.literal("focus"),
    narration,
    icon,
    heading: text(60),
    callouts: z.array(z.object({ label: text(40), cue })).max(3),
  }),
  z.object({ type: z.literal("iconList"), narration, heading: text(60), items: z.array(cueItem).min(1).max(4) }),
  z.object({ type: z.literal("flow"), narration, heading: text(60), steps: z.array(cueItem).min(1).max(4) }),
  z.object({
    type: z.literal("cycle"),
    narration,
    heading: text(60),
    centerLabel: text(40).optional(),
    steps: z.array(cueItem).min(2).max(6),
  }),
  z.object({
    type: z.literal("summary"),
    narration,
    heading: text(60),
    points: z.array(z.object({ text: text(60), cue })).min(1).max(4),
  }),
  z.object({
    type: z.literal("arraySearch"),
    narration,
    heading: text(60),
    values: z.array(z.number().int()).min(3).max(11),
    target: z.number().int(),
    steps: z.array(z.object({ cue })).max(6),
  }),
]);
export type Scene = z.infer<typeof sceneSchema>;

export const MIN_SCENES = 3;
export const MAX_SCENES = 12;

export const storyboardSchema = z.object({
  topic: z.string().trim().max(200),
  title: text(120),
  scenes: z.array(sceneSchema).max(MAX_SCENES),
});
export type Storyboard = z.infer<typeof storyboardSchema>;

export type StoryboardVersionRecord = {
  id: string;
  projectId: string;
  userId: string;
  version: number;
  storyboard: Storyboard;
  wordCount: number;
  estSeconds: number;
  createdBy: "ai" | "user";
  changeNote: string | null;
  changedScenes: number[];
  /** The version this one was made from; undo walks back along it. */
  parentVersion: number | null;
  createdAt: Date;
};

export type StoryboardVersion = {
  version: number;
  storyboard: Storyboard;
  wordCount: number;
  estSeconds: number;
  createdBy: "ai" | "user";
  changeNote: string | null;
  changedScenes: number[];
  canUndo: boolean;
  createdAt: string;
};

export function toStoryboardVersion(r: StoryboardVersionRecord): StoryboardVersion {
  return {
    version: r.version,
    storyboard: r.storyboard,
    wordCount: r.wordCount,
    estSeconds: r.estSeconds,
    createdBy: r.createdBy,
    changeNote: r.changeNote,
    changedScenes: r.changedScenes,
    canUndo: r.parentVersion !== null,
    createdAt: r.createdAt.toISOString(),
  };
}

/** George reads about 2.45 words a second (measured on the prototype renders). */
export const WORDS_PER_SECOND = 2.45;

export function splitWords(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

export function sceneSeconds(scene: Pick<Scene, "narration">): number {
  return splitWords(scene.narration).length / WORDS_PER_SECOND;
}

export function wordCount(sb: Storyboard): number {
  return sb.scenes.reduce((n, s) => n + splitWords(s.narration).length, 0);
}

export function estSeconds(sb: Storyboard): number {
  return Math.round((wordCount(sb) / WORDS_PER_SECOND) * 10) / 10;
}

/** "1:14" */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Indexes (in `next`) of scenes that are new or differ from `prev`. */
export function changedScenes(prev: Storyboard | null, next: Storyboard): number[] {
  if (!prev) return next.scenes.map((_, i) => i);
  const before = new Set(prev.scenes.map((s) => JSON.stringify(s)));
  return next.scenes.flatMap((s, i) => (before.has(JSON.stringify(s)) ? [] : [i]));
}

/** A word as a cue matches regardless of case and punctuation. */
const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}%]/gu, "");

/**
 * Keeps every cue on a word that is in the narration, in order, so visuals still have a moment
 * to appear after the narration is edited. A cue that went missing moves to a spread-out word.
 */
export function repairCues(scene: Scene): Scene {
  const words = splitWords(scene.narration).map(bare).filter(Boolean);
  if (words.length === 0) return scene;
  let from = 0;
  const fix = (c: string | undefined, i: number, n: number): string => {
    const at = c ? words.indexOf(bare(c), from) : -1;
    const pos = at >= 0 ? at : Math.min(words.length - 1, Math.max(from, Math.floor(((i + 1) * words.length) / (n + 1))));
    from = Math.min(words.length - 1, pos + 1);
    return splitWords(scene.narration).filter((w) => bare(w))[pos].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, "");
  };
  switch (scene.type) {
    case "stat":
      return { ...scene, cue: fix(scene.cue, 0, 1) };
    case "focus":
      return { ...scene, callouts: scene.callouts.map((c, i, a) => ({ ...c, cue: fix(c.cue, i, a.length) })) };
    case "iconList":
      return { ...scene, items: scene.items.map((c, i, a) => ({ ...c, cue: fix(c.cue, i, a.length) })) };
    case "flow":
    case "cycle":
      return { ...scene, steps: scene.steps.map((c, i, a) => ({ ...c, cue: fix(c.cue, i, a.length) })) };
    case "summary":
      return { ...scene, points: scene.points.map((c, i, a) => ({ ...c, cue: fix(c.cue, i, a.length) })) };
    case "arraySearch":
      return { ...scene, steps: scene.steps.map((c, i, a) => ({ cue: fix(c.cue, i, a.length) })) };
    default:
      return scene;
  }
}

/** The scene's on-screen heading, whatever its type. */
export function sceneHeading(scene: Scene): string {
  switch (scene.type) {
    case "title":
      return scene.title;
    case "stat":
      return `${scene.value} ${scene.label}`;
    default:
      return scene.heading;
  }
}

/** One line on what the viewer sees, for the scene card. */
export function sceneVisual(scene: Scene): string {
  switch (scene.type) {
    case "title":
      return scene.subtitle ? `Title card: ${scene.subtitle}` : "Title card";
    case "stat":
      return `Big number ${scene.value}`;
    case "focus":
      return [scene.icon, ...scene.callouts.map((c) => c.label)].join(" · ");
    case "iconList":
      return scene.items.map((i) => i.label).join(" · ");
    case "flow":
      return scene.steps.map((s) => s.label).join(" → ");
    case "cycle":
      return `${scene.steps.map((s) => s.label).join(" → ")} ↺`;
    case "summary":
      return scene.points.map((p) => p.text).join(" · ");
    case "arraySearch":
      return `Search ${scene.values.join(", ")} for ${scene.target}`;
  }
}

/** The scene with its on-screen heading changed (the field depends on the type). */
export function withHeading(scene: Scene, heading: string): Scene {
  switch (scene.type) {
    case "title":
      return { ...scene, title: heading.slice(0, 80) };
    case "stat":
      return { ...scene, label: heading.slice(0, 80) };
    default:
      return { ...scene, heading: heading.slice(0, 60) };
  }
}

/** The text the heading field edits (a stat's heading is its label; the number stays). */
export function editableHeading(scene: Scene): string {
  switch (scene.type) {
    case "title":
      return scene.title;
    case "stat":
      return scene.label;
    default:
      return scene.heading;
  }
}

/** The cue words of a scene, in order: where each visual appears. */
export function sceneCues(scene: Scene): string[] {
  switch (scene.type) {
    case "title":
      return [];
    case "stat":
      return scene.cue ? [scene.cue] : [];
    case "focus":
      return scene.callouts.map((c) => c.cue);
    case "iconList":
      return scene.items.map((c) => c.cue);
    case "flow":
    case "cycle":
      return scene.steps.map((c) => c.cue);
    case "summary":
      return scene.points.map((c) => c.cue);
    case "arraySearch":
      return scene.steps.map((c) => c.cue);
  }
}

/** Narration split into words, each marked when a visual appears on it (cues matched in order). */
export function cueMarks(scene: Scene): { word: string; cue: boolean }[] {
  const cues = sceneCues(scene).map(bare);
  let next = 0;
  return splitWords(scene.narration).map((word) => {
    const hit = next < cues.length && bare(word) === cues[next];
    if (hit) next++;
    return { word, cue: hit };
  });
}
