import React from "react";
import { icons } from "lucide";
import { theme } from "../theme";
import { useEnter } from "./anim";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type Node = [string, Record<string, string | number>];

export function getIconNodes(name: string): Node[] {
  const lib = icons as unknown as Record<string, Node[]>;
  return lib[name] ?? lib["Circle"];
}

// Line icon that draws itself on, stroke by stroke.
export const DrawIcon: React.FC<{
  name: string;
  size: number;
  at: number; // local frame to start drawing
  color?: string;
  strokeWidth?: number;
  drawFrames?: number;
}> = ({ name, size, at, color = theme.ink, strokeWidth = 1.6, drawFrames = 26 }) => {
  const nodes = getIconNodes(name);
  const p = useEnter(at, drawFrames);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ overflow: "visible" }}>
      {nodes.map(([tag, attrs], i) => {
        // stagger strokes slightly
        const local = Math.min(1, Math.max(0, p * (1 + nodes.length * 0.15) - i * 0.15));
        return React.createElement(tag, {
          key: i,
          ...attrs,
          pathLength: 1,
          stroke: color,
          strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          fill: "none",
          strokeDasharray: 1,
          strokeDashoffset: 1 - local,
        });
      })}
    </svg>
  );
};

// Icon inside a soft accent disc that pops in, then the icon draws on.
export const IconBadge: React.FC<{
  name: string;
  size: number; // disc diameter
  at: number;
  active?: boolean;
}> = ({ name, size, at, active = false }) => {
  const p = useEnter(at, 14);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Pops in with a little overshoot, then a ring ripples out once.
  const pop = spring({ frame: frame - at, fps, config: { damping: 9, mass: 0.6, stiffness: 160 } });
  const scale = 0.5 + 0.5 * pop;
  const ripple = interpolate(frame, [at + 4, at + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // gentle float once settled, phase offset per badge so they don't move in lockstep
  const bob = frame > at + 14 ? Math.sin((frame - at) / 22 + at) * 5 : 0;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: active ? theme.accent : "rgba(47,125,225,0.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${bob}px) scale(${scale})`,
        boxShadow: active ? "0 14px 30px rgba(47,125,225,0.28)" : "none",
        opacity: p,
        transition: "none",
        position: "relative",
      }}
    >
      {ripple > 0 && ripple < 1 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `4px solid ${theme.accent}`,
            transform: `scale(${1 + ripple * 0.6})`,
            opacity: (1 - ripple) * 0.6,
          }}
        />
      )}
      <DrawIcon
        name={name}
        size={size * 0.52}
        at={at + 4}
        color={active ? theme.white : theme.ink}
        strokeWidth={1.7}
      />
    </div>
  );
};
