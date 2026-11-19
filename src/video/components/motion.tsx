import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

/** Frames two scenes share while one hands over to the next. */
export const OVERLAP = 14;

export type TransitionKind = "push" | "zoom" | "wipe" | "rise";
const KINDS: TransitionKind[] = ["push", "zoom", "wipe", "rise"];
/** The transition between scene i and scene i + 1: varied, but the same every render. */
export const transitionAfter = (i: number): TransitionKind => KINDS[i % KINDS.length];

const ease = Easing.bezier(0.65, 0, 0.35, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * One scene's frame: it enters with the transition from the scene before, moves under a slow
 * camera, and leaves with the transition to the next one (while that one is already entering).
 */
export const SceneMotion: React.FC<{
  frames: number;
  enter: TransitionKind | "first";
  exit: TransitionKind | null;
  children: React.ReactNode;
}> = ({ frames, enter, exit, children }) => {
  const f = useCurrentFrame();
  const pin = interpolate(f, [0, OVERLAP], [0, 1], { ...clamp, easing: ease });
  const pout = exit ? interpolate(f, [frames, frames + OVERLAP], [0, 1], { ...clamp, easing: ease }) : 0;

  // Camera: a slow push-in and a gentle sway for the whole scene.
  const life = interpolate(f, [0, frames + OVERLAP], [0, 1], clamp);
  const cam = `translate(${Math.sin(f / 75) * 7}px, ${-life * 14}px) scale(${1 + 0.035 * life})`;

  let tIn = "";
  let oIn = 1;
  let blurIn = 0;
  let clip: string | undefined;
  switch (enter) {
    case "first":
      tIn = `scale(${0.9 + 0.1 * pin})`;
      oIn = pin;
      blurIn = (1 - pin) * 10;
      break;
    case "push":
      tIn = `translateX(${(1 - pin) * 320}px)`;
      oIn = pin;
      break;
    case "zoom":
      tIn = `scale(${0.86 + 0.14 * pin})`;
      oIn = pin;
      blurIn = (1 - pin) * 12;
      break;
    case "wipe":
      clip = pin < 1 ? `circle(${pin * 120}% at 50% 46%)` : undefined;
      break;
    case "rise":
      tIn = `translateY(${(1 - pin) * 260}px)`;
      oIn = pin;
      break;
  }

  let tOut = "";
  let oOut = 1;
  let blurOut = 0;
  switch (exit) {
    case "push":
      tOut = `translateX(${-pout * 320}px)`;
      oOut = 1 - pout;
      break;
    case "zoom":
      tOut = `scale(${1 + 0.3 * pout})`;
      oOut = 1 - pout;
      blurOut = pout * 14;
      break;
    case "wipe":
      tOut = `scale(${1 - 0.05 * pout})`;
      oOut = 1 - pout * 0.7;
      break;
    case "rise":
      tOut = `translateY(${-pout * 220}px)`;
      oOut = 1 - pout;
      break;
  }

  const blur = blurIn + blurOut;
  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(oIn, oOut),
        transform: `${tIn} ${tOut} ${cam}`,
        filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined,
        clipPath: clip,
        // A wipe brings its own paper so the scene underneath is covered inside the circle.
        background: clip ? theme.bg : undefined,
      }}
    >
      {children}
      {enter === "wipe" && pin < 1 && <WipeRing p={pin} />}
    </AbsoluteFill>
  );
};

/** The accent ring that rides the edge of a circular wipe. */
const WipeRing: React.FC<{ p: number }> = ({ p }) => {
  const r = p * 120 * 0.01 * Math.hypot(1080, 1920) * 0.71;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <circle cx={540} cy={1920 * 0.46} r={r} fill="none" stroke={theme.accent} strokeWidth={10} opacity={0.5 * (1 - p)} />
    </svg>
  );
};

/** A small glowing dot that travels a straight line, over and over (things flowing). */
export const Traveller: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  from: number;
  period?: number;
  offset?: number;
  size?: number;
}> = ({ x1, y1, x2, y2, from, period = 42, offset = 0, size = 11 }) => {
  const f = useCurrentFrame();
  if (f < from) return null;
  const t = (((f - from + offset) % period) + period) % period / period;
  const k = Easing.inOut(Easing.sin)(t);
  const fade = Math.min(1, t * 6, (1 - t) * 6);
  return (
    <circle
      cx={x1 + (x2 - x1) * k}
      cy={y1 + (y2 - y1) * k}
      r={size}
      fill={theme.accent}
      opacity={fade}
      style={{ filter: "drop-shadow(0 0 10px rgba(47,125,225,0.7))" }}
    />
  );
};
