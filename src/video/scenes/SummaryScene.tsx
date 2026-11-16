import React from "react";
import { AbsoluteFill } from "remotion";
import type { SummaryScene as T } from "../types";
import { theme, zones } from "../theme";
import { DrawIcon } from "../components/DrawIcon";
import { Heading } from "../components/Text";
import { useEnter } from "../components/anim";
import { useCueFrames, type SceneProps } from "./common";

const Point: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const p = useEnter(at, 16);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 36, opacity: p }}>
      <div
        style={{
          width: 96,
          height: 96,
          flexShrink: 0,
          borderRadius: 48,
          background: theme.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <DrawIcon name="Check" size={58} at={at + 4} color={theme.white} strokeWidth={2.6} drawFrames={12} />
      </div>
      <div
        style={{
          fontFamily: theme.font,
          fontWeight: 600,
          fontSize: 46,
          lineHeight: 1.2,
          color: theme.ink,
          transform: `translateX(${(1 - p) * 24}px)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const SummaryScene: React.FC<SceneProps<T>> = ({ scene, timing }) => {
  const at = useCueFrames(timing, scene.points.map((p) => p.cue));
  return (
    <AbsoluteFill>
      <Heading text={scene.heading} />
      <div
        style={{
          position: "absolute",
          top: zones.visualTop + 40,
          bottom: 1920 - zones.visualBottom,
          left: 130,
          right: 100,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 56,
        }}
      >
        {scene.points.map((pt, i) => (
          <Point key={i} text={pt.text} at={at[i]} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
