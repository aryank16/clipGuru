import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Scene3DScene as T } from "../types";
import { theme } from "../theme";
import { Heading } from "../components/Text";
import { useEnter } from "../components/anim";
import { useCueFrames, type SceneProps } from "./common";
import { Impact } from "../three/Impact";
import { Orbit } from "../three/Orbit";
import { Globe } from "../three/Globe";
import { Molecule } from "../three/Molecule";
import { Stack } from "../three/Stack";

const Chip: React.FC<{ text: string; at: number; current: boolean }> = ({ text, at, current }) => {
  const p = useEnter(at, 14);
  return (
    <div
      style={{
        fontFamily: theme.font,
        fontWeight: 600,
        fontSize: 38,
        color: current ? theme.white : theme.ink,
        background: current ? theme.accent : theme.white,
        border: `3px solid ${theme.accent}`,
        borderRadius: 999,
        padding: "12px 30px",
        opacity: p,
        transform: `translateY(${(1 - p) * 20}px) scale(${0.85 + 0.15 * p})`,
        boxShadow: current ? "0 12px 28px rgba(47,125,225,0.3)" : "none",
      }}
    >
      {text}
    </div>
  );
};

/** A ready-made 3D shot, with the heading above and each item's chip below as it appears in 3D. */
export const Scene3DScene: React.FC<SceneProps<T>> = ({ scene, timing }) => {
  const frame = useCurrentFrame();
  const cues = useCueFrames(timing, scene.items.map((i) => i.cue), 0);
  let current = -1;
  cues.forEach((c, i) => {
    if (frame >= c) current = i;
  });
  const Shot = { impact: Impact, orbit: Orbit, globe: Globe, molecule: Molecule, stack: Stack }[scene.preset];
  return (
    <AbsoluteFill>
      <Shot cues={cues} />
      <Heading text={scene.heading} />
      <div style={{ position: "absolute", top: 1250, left: 60, right: 60, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20 }}>
        {scene.items.map((it, i) => (
          <Chip key={i} text={it.label} at={cues[i]} current={i === current} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
