import { useVideoConfig } from "remotion";
import type { SceneTiming } from "../types";
import { cueTimes } from "../timing";

export type SceneProps<T> = { scene: T; timing: SceneTiming };

// Frames (local to the scene) when each cue word is spoken, a touch early
// so the visual lands with the word rather than after it.
export function useCueFrames(timing: SceneTiming, cues: string[], lead = 4): number[] {
  const { fps } = useVideoConfig();
  // Never later than ~1.6s before the scene ends, so every item gets seen.
  const latest = Math.round((timing.endSec - timing.startSec) * fps) - 48;
  return cueTimes(timing, cues).map((s) => Math.max(6, Math.min(latest, Math.round(s * fps) - lead)));
}

export function useSceneFrames(timing: SceneTiming) {
  const { fps } = useVideoConfig();
  return Math.round((timing.endSec - timing.startSec) * fps);
}
