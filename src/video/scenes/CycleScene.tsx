import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { CycleScene as T } from "../types";
import { theme } from "../theme";
import { IconBadge } from "../components/DrawIcon";
import { DrawPath } from "../components/Arrow";
import { Heading, Label } from "../components/Text";
import { useEnter } from "../components/anim";
import { useCueFrames, useSceneFrames, type SceneProps } from "./common";

const CX = 540;
const CY = 890;

export const CycleScene: React.FC<SceneProps<T>> = ({ scene, timing }) => {
  const frame = useCurrentFrame();
  const n = scene.steps.length;
  const at = useCueFrames(timing, scene.steps.map((s) => s.cue));
  const total = useSceneFrames(timing);
  const R = n <= 4 ? 300 : 320;
  const disc = n <= 4 ? 170 : 140;
  const start = Math.PI; // first step on the left, then clockwise
  const angles = scene.steps.map((_, i) => start + (i * 2 * Math.PI) / n);
  const pt = (a: number, r = R) => ({ x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) });
  const gapAng = Math.asin(Math.min(0.95, (disc / 2 + 26) / R));
  const ring = useEnter(4, 30);

  const arcs = angles.map((a) => {
    const a1 = a + gapAng;
    const a2 = a + (2 * Math.PI) / n - gapAng;
    const p1 = pt(a1);
    const p2 = pt(a2);
    return `M ${p1.x} ${p1.y} A ${R} ${R} 0 0 1 ${p2.x} ${p2.y}`;
  });
  const closeAt = Math.min(at[n - 1] + 26, Math.max(at[n - 1] + 10, total - 30));
  const arrowAt = (i: number) => (i < n - 1 ? at[i + 1] - 12 : closeAt);

  let active = -1;
  at.forEach((f, i) => {
    if (frame >= f) active = i;
  });
  const allLit = frame >= closeAt + 20;

  return (
    <AbsoluteFill>
      <Heading text={scene.heading} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={theme.line}
          strokeWidth={3}
          strokeDasharray="4 16"
          strokeLinecap="round"
          opacity={ring}
        />
        {arcs.map((d, i) => (
          <DrawPath key={i} d={d} at={arrowAt(i)} frames={18} color={theme.accent} width={6} />
        ))}
        {frame > arrowAt(0) + 10 &&
          [0, 1, 2].map((k) => {
            // Three dots ride the loop clockwise, faster once the whole cycle is drawn.
            const speed = allLit ? 0.022 : 0.012;
            const a = start + (frame - arrowAt(0)) * speed + (k * 2 * Math.PI) / 3;
            const q = pt(a);
            const fade = Math.min(1, (frame - arrowAt(0) - 10) / 12);
            return (
              <circle
                key={k}
                cx={q.x}
                cy={q.y}
                r={10}
                fill={theme.accent}
                opacity={fade * 0.9}
                style={{ filter: "drop-shadow(0 0 10px rgba(47,125,225,0.7))" }}
              />
            );
          })}
      </svg>
      {scene.centerLabel && (
        <div
          style={{
            position: "absolute",
            left: CX - 170,
            width: 340,
            top: CY - 40,
            textAlign: "center",
          }}
        >
          <Label text={scene.centerLabel} at={10} size={42} color={theme.muted} />
        </div>
      )}
      {scene.steps.map((s, i) => {
        const p = pt(angles[i]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x - 170,
              top: p.y - disc / 2,
              width: 340,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <IconBadge name={s.icon} size={disc} at={at[i]} active={i === active || allLit} />
            <Label
              text={s.label}
              at={at[i] + 6}
              size={n <= 4 ? 40 : 34}
              // off-white backing so the label never sits on top of an arrow
              style={{ textAlign: "center", background: theme.bg, padding: "2px 14px", borderRadius: 12 }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
