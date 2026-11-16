import type { Scene, Storyboard } from "@/lib/storyboard/types";

/**
 * Types for the video composition (ported from the prototype). The storyboard and scene shapes are
 * the app's own (src/lib/storyboard/types.ts); these add the voiceover timing on top.
 */
export type { Scene, Storyboard };
type Of<K extends Scene["type"]> = Extract<Scene, { type: K }>;
export type TitleScene = Of<"title">;
export type IconListScene = Of<"iconList">;
export type CycleScene = Of<"cycle">;
export type FlowScene = Of<"flow">;
export type FocusScene = Of<"focus">;
export type StatScene = Of<"stat">;
export type SummaryScene = Of<"summary">;
export type ArraySearchScene = Of<"arraySearch">;

/** One spoken word, in seconds from the start of the video. */
export type Word = { text: string; start: number; end: number };

export type VideoProps = {
  storyboard: Storyboard;
  words: Word[];
  /** A file in public/, an app path (/api/…) or a full URL; null for a silent preview. */
  audioSrc: string | null;
  durationSec: number;
  accent?: string;
};

/** Computed per scene. */
export type SceneTiming = {
  startSec: number;
  endSec: number;
  /** This scene's words, times relative to the video. */
  words: Word[];
};
