import React from "react";
import { AbsoluteFill } from "remotion";
import type { IconListScene as T } from "../types";
import { theme, zones } from "../theme";
import { IconBadge } from "../components/DrawIcon";
import { Heading } from "../components/Text";
import { useEnter } from "../components/anim";
import { useCueFrames, type SceneProps } from "./common";

const Row: React.FC<{ icon: string; label: string; at: number }> = ({ icon, label, at }) => {
  const p = useEnter(at, 18);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 44,
        opacity: p,
        transform: `translateX(${(1 - p) * -40}px)`,
      }}
    >
      <IconBadge name={icon} size={150} at={at} />
      <div style={{ fontFamily: theme.font, fontWeight: 600, fontSize: 50, color: theme.ink, lineHeight: 1.15 }}>
        {label}
      </div>
    </div>
  );
};

export const IconListScene: React.FC<SceneProps<T>> = ({ scene, timing }) => {
  const at = useCueFrames(timing, scene.items.map((i) => i.cue));
  const n = scene.items.length;
  const gap = n >= 4 ? 40 : 64;
  return (
    <AbsoluteFill>
      <Heading text={scene.heading} />
      <div
        style={{
          position: "absolute",
          top: zones.visualTop + 40,
          bottom: 1920 - zones.visualBottom,
          left: 150,
          right: 100,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap,
        }}
      >
        {scene.items.map((it, i) => (
          <Row key={i} icon={it.icon} label={it.label} at={at[i]} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
