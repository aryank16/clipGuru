import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Traveller } from "../components/motion";
import type { FlowScene as T } from "../types";
import { theme, zones } from "../theme";
import { IconBadge } from "../components/DrawIcon";
import { DrawPath } from "../components/Arrow";
import { Heading, Label } from "../components/Text";
import { useCueFrames, type SceneProps } from "./common";

// Vertical step-by-step process with arrows drawing between steps.
export const FlowScene: React.FC<SceneProps<T>> = ({ scene, timing }) => {
  const n = scene.steps.length;
  const at = useCueFrames(timing, scene.steps.map((s) => s.cue));
  const top = zones.visualTop + 30;
  const span = zones.visualBottom - top;
  const step = span / n;
  const disc = n >= 4 ? 130 : 150;
  const x = 250;
  const frame = useCurrentFrame();
  let current = -1;
  at.forEach((f, i) => {
    if (frame >= f) current = i;
  });
  return (
    <AbsoluteFill>
      <Heading text={scene.heading} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {scene.steps.slice(0, -1).map((_, i) => {
          const y1 = top + step * i + step / 2 + disc / 2 + 14;
          const y2 = top + step * (i + 1) + step / 2 - disc / 2 - 14;
          return (
            <g key={i}>
              <DrawPath d={`M ${x} ${y1} L ${x} ${y2}`} at={at[i + 1] - 10} frames={12} color={theme.accent} width={6} />
              <Traveller x1={x} y1={y1} x2={x} y2={y2 - 10} from={at[i + 1] + 4} offset={i * 11} />
            </g>
          );
        })}
      </svg>
      {scene.steps.map((s, i) => {
        const cy = top + step * i + step / 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - disc / 2,
              top: cy - disc / 2,
              right: 80,
              height: disc,
              display: "flex",
              alignItems: "center",
              gap: 44,
            }}
          >
            <IconBadge name={s.icon} size={disc} at={at[i]} active={i === current} />
            <Label text={s.label} at={at[i] + 5} size={46} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
