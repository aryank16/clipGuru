import React from "react";
import { evolvePath, getPointAtLength, getTangentAtLength, getLength } from "@remotion/paths";
import { theme } from "../theme";
import { useEnter } from "./anim";

// A path that draws on from start to end, with an arrowhead that follows the tip.
export const DrawPath: React.FC<{
  d: string;
  at: number;
  frames?: number;
  color?: string;
  width?: number;
  head?: boolean;
  dashed?: boolean;
}> = ({ d, at, frames = 20, color = theme.ink, width = 5, head = true, dashed = false }) => {
  const p = useEnter(at, frames);
  if (p <= 0) return null;
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, d);
  const len = getLength(d);
  const tip = getPointAtLength(d, len * p) ?? { x: 0, y: 0 };
  const tan = getTangentAtLength(d, Math.max(0.01, len * p - 0.01)) ?? { x: 1, y: 0 };
  const angle = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? undefined : strokeDasharray}
        strokeDashoffset={dashed ? undefined : strokeDashoffset}
        style={dashed ? { strokeDasharray: "2 14", opacity: p } : undefined}
      />
      {head && (
        <path
          d="M -16 -11 L 0 0 L -16 11"
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${tip.x} ${tip.y}) rotate(${angle})`}
          opacity={Math.min(1, p * 4)}
        />
      )}
    </g>
  );
};
