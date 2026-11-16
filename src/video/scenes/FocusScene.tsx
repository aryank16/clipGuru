import React from "react";
import { AbsoluteFill } from "remotion";
import type { FocusScene as T } from "../types";
import { theme } from "../theme";
import { DrawIcon } from "../components/DrawIcon";
import { Heading } from "../components/Text";
import { useEnter } from "../components/anim";
import { useCueFrames, type SceneProps } from "./common";

const Chip: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const p = useEnter(at, 14);
  return (
    <div
      style={{
        fontFamily: theme.font,
        fontWeight: 600,
        fontSize: 40,
        color: theme.ink,
        border: `3px solid ${theme.accent}`,
        borderRadius: 999,
        padding: "14px 34px",
        opacity: p,
        transform: `scale(${0.85 + 0.15 * p})`,
        background: theme.white,
      }}
    >
      {text}
    </div>
  );
};

// One big icon as the hero, with short callouts that pop in on cue.
export const FocusScene: React.FC<SceneProps<T>> = ({ scene, timing }) => {
  const at = useCueFrames(timing, scene.callouts.map((c) => c.cue));
  const disc = useEnter(2, 20);
  return (
    <AbsoluteFill>
      <Heading text={scene.heading} />
      <div
        style={{
          position: "absolute",
          left: 540 - 220,
          top: 540,
          width: 440,
          height: 440,
          borderRadius: 220,
          background: "rgba(47,125,225,0.10)",
          opacity: disc,
          transform: `scale(${0.7 + 0.3 * disc})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <DrawIcon name={scene.icon} size={240} at={6} drawFrames={32} strokeWidth={1.4} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 1060,
          left: 70,
          right: 70,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {scene.callouts.map((c, i) => (
          <Chip key={i} text={c.label} at={at[i]} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
