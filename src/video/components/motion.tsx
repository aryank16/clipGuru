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
 * One scene's frame, filmed on a 3D stage: it enters with the transition from the scene before
 * (swinging in like a card, dollying in from depth, or tilting up), drifts under a slow camera
 * that dollies in and turns a few degrees, and leaves while the next one is already entering.
 */
export const SceneMotion: React.FC<{
  frames: number;
  enter: TransitionKind | "first";
  exit: TransitionKind | null;
  children: React.ReactNode;
}> = ({ frames, enter, exit, children }) => {
  const f = useCurrentFrame();
  const pin = interpolate(f, [0, OVERLAP], [0, 1], { ...clamp, easing: ease });
  const pout = exit
    ? interpolate(f, [frames, frames + OVERLAP], [0, 1], {
        ...clamp,
        easing: ease,
      })
    : 0;

  // Camera: a slow dolly-in with a gentle turn, as if a camera on a slider films the scene.
  const life = interpolate(f, [0, frames + OVERLAP], [0, 1], clamp);
  const cam = `translateZ(${life * 70}px) rotateY(${Math.sin(f / 95) * 2.6}deg) rotateX(${Math.cos(f / 120) * 1.6}deg) translateY(${-life * 10}px)`;

  let tIn = "";
  let oIn = 1;
  let blurIn = 0;
  let clip: string | undefined;
  const qi = 1 - pin;
  switch (enter) {
    case "first":
      tIn = `translateZ(${-qi * 420}px) rotateX(${qi * 14}deg)`;
      oIn = pin;
      blurIn = qi * 10;
      break;
    case "push":
      // Swings in from the right like a card on a hinge.
      tIn = `translateX(${qi * 520}px) translateZ(${-qi * 380}px) rotateY(${-qi * 58}deg)`;
      oIn = Math.min(1, pin * 1.6);
      break;
    case "zoom":
      // Comes forward out of the depth.
      tIn = `translateZ(${-qi * 900}px)`;
      oIn = pin;
      blurIn = qi * 12;
      break;
    case "wipe":
      clip = pin < 1 ? `circle(${pin * 120}% at 50% 46%)` : undefined;
      tIn = `translateZ(${-qi * 120}px)`;
      break;
    case "rise":
      // Tilts up off the floor.
      tIn = `translateY(${qi * 420}px) translateZ(${-qi * 200}px) rotateX(${qi * 62}deg)`;
      oIn = Math.min(1, pin * 1.6);
      break;
  }

  let tOut = "";
  let oOut = 1;
  let blurOut = 0;
  switch (exit) {
    case "push":
      tOut = `translateX(${-pout * 520}px) translateZ(${-pout * 380}px) rotateY(${pout * 58}deg)`;
      oOut = 1 - pout;
      break;
    case "zoom":
      // The camera flies through it.
      tOut = `translateZ(${pout * 650}px)`;
      oOut = 1 - pout;
      blurOut = pout * 14;
      break;
    case "wipe":
      tOut = `translateZ(${-pout * 160}px)`;
      oOut = 1 - pout * 0.7;
      break;
    case "rise":
      tOut = `translateY(${-pout * 360}px) translateZ(${-pout * 200}px) rotateX(${-pout * 48}deg)`;
      oOut = 1 - pout;
      break;
  }

  const blur = blurIn + blurOut;
  return (
    // The camera: perspective from slightly above the middle of the frame.
    <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: "50% 42%" }}>
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
  const t = ((((f - from + offset) % period) + period) % period) / period;
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
