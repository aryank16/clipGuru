import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../theme";

// Subtle living background: a faint dot grid that drifts, and two soft
// accent glows that slowly float. Keeps the frame calm but never static.
export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const drift = (f * 0.25) % 48;
  const g1x = 160 + Math.sin(f / 90) * 80;
  const g1y = 420 + Math.cos(f / 110) * 60;
  const g2x = 920 + Math.cos(f / 100) * 70;
  const g2y = 1500 + Math.sin(f / 80) * 70;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${theme.line} 2.2px, transparent 2.4px)`,
          backgroundSize: "48px 48px",
          backgroundPosition: `${drift}px ${drift}px`,
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: g1x - 360,
          top: g1y - 360,
          width: 720,
          height: 720,
          borderRadius: 360,
          background: "radial-gradient(circle, rgba(47,125,225,0.10) 0%, rgba(47,125,225,0) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: g2x - 400,
          top: g2y - 400,
          width: 800,
          height: 800,
          borderRadius: 400,
          background: "radial-gradient(circle, rgba(47,125,225,0.08) 0%, rgba(47,125,225,0) 70%)",
        }}
      />
      <Parallax />
    </AbsoluteFill>
  );
};

// Depth: outline shapes at three distances drift up at different speeds (near ones faster and
// bigger), so the camera feels like it moves through space. Fixed positions, so every render matches.
const SHAPES: { x: number; y: number; r: number; depth: 1 | 2 | 3; kind: "ring" | "plus" | "dot" }[] = [
  { x: 120, y: 300, r: 46, depth: 1, kind: "ring" },
  { x: 950, y: 520, r: 22, depth: 2, kind: "plus" },
  { x: 860, y: 1180, r: 70, depth: 1, kind: "ring" },
  { x: 180, y: 1020, r: 10, depth: 3, kind: "dot" },
  { x: 610, y: 1720, r: 18, depth: 2, kind: "plus" },
  { x: 980, y: 1660, r: 9, depth: 3, kind: "dot" },
  { x: 70, y: 1560, r: 30, depth: 2, kind: "ring" },
  { x: 520, y: 140, r: 8, depth: 3, kind: "dot" },
];
const SPEED = { 1: 0.12, 2: 0.3, 3: 0.55 } as const;

const Parallax: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {SHAPES.map((s, i) => {
        const y = ((((s.y - f * SPEED[s.depth]) % 2100) + 2100) % 2100) - 90;
        const x = s.x + Math.sin(f / (60 + i * 9) + i) * 14 * s.depth;
        const rot = (f * (i % 2 ? 0.3 : -0.25)) % 360;
        const o = s.depth === 3 ? 0.35 : 0.6;
        if (s.kind === "dot") return <circle key={i} cx={x} cy={y} r={s.r} fill={theme.accent} opacity={o * 0.5} />;
        if (s.kind === "ring")
          return <circle key={i} cx={x} cy={y} r={s.r} fill="none" stroke={theme.line} strokeWidth={4} opacity={o + 0.2} />;
        return (
          <path
            key={i}
            d={`M ${-s.r} 0 L ${s.r} 0 M 0 ${-s.r} L 0 ${s.r}`}
            stroke={theme.line}
            strokeWidth={5}
            strokeLinecap="round"
            transform={`translate(${x} ${y}) rotate(${rot})`}
            opacity={o + 0.2}
          />
        );
      })}
    </svg>
  );
};