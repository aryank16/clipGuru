import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Scene3DScene as T } from "../types";
import { theme } from "../theme";
import { Heading } from "../components/Text";
import { useEnter } from "../components/anim";
import { spreadCues } from "../three/cues";
import { useCueFrames, useSceneFrames, type SceneProps } from "./common";
import { MODELS, ModelShot, type ModelId } from "../three/models";
import { Impact } from "../three/Impact";
import { Orbit } from "../three/Orbit";
import { Globe } from "../three/Globe";
import { Molecule } from "../three/Molecule";
import { Stack } from "../three/Stack";

const Chip: React.FC<{ text: string; at: number; current: boolean; small: boolean }> = ({ text, at, current, small }) => {
  const p = useEnter(at, 14);
  return (
    <div
      style={{
        fontFamily: theme.font,
        fontWeight: 600,
        fontSize: small ? 30 : 38,
        maxWidth: small ? 470 : 960,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: current ? theme.white : theme.ink,
        background: current ? theme.accent : theme.white,
        border: `3px solid ${theme.accent}`,
        borderRadius: 999,
        padding: small ? "10px 24px" : "12px 30px",
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
  const cues = spreadCues(useCueFrames(timing, scene.items.map((i) => i.cue), 0));
  let current = -1;
  cues.forEach((c, i) => {
    if (frame >= c) current = i;
  });
  // Chips never wrap into the captions: one row when they fit, else at most two rows of two, smaller.
  const n = scene.items.length;
  const chars = scene.items.reduce((a, i) => a + i.label.length, 0);
  const small = chars > 30 || n > 3;
  const twoRows = n > 2 && chars > 36;
  const frames = useSceneFrames(timing);
  const preset = scene.preset;
  const Shot = preset in MODELS ? null : { impact: Impact, orbit: Orbit, globe: Globe, molecule: Molecule, stack: Stack }[preset as "orbit"];
  return (
    <AbsoluteFill>
      {Shot ? <Shot cues={cues} /> : <ModelShot model={preset as ModelId} cues={cues} frames={frames} />}
      <Heading text={scene.heading} />
      <div
        style={{
          position: "absolute",
          top: twoRows ? 1175 : 1250,
          left: 50,
          right: 50,
          display: "grid",
          gridTemplateColumns: `repeat(${twoRows ? 2 : n}, auto)`,
          justifyContent: "center",
          justifyItems: "center",
          gap: 16,
        }}
      >
        {scene.items.map((it, i) => (
          <Chip key={i} text={it.label} at={cues[i]} current={i === current} small={small} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
