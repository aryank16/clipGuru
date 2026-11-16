import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";

// 0 -> 1 progress that starts at `at` frames (local to the scene).
export function useEnter(at: number, durationFrames = 18) {
  const frame = useCurrentFrame();
  return interpolate(frame, [at, at + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
}

export function useSpring(at: number, damping = 14) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, mass: 0.7 } });
}

export const secToFrames = (s: number, fps: number) => Math.round(s * fps);
