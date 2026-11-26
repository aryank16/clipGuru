import React from "react";
import { AbsoluteFill } from "remotion";
import type { TitleScene as T } from "../types";
import { theme } from "../theme";
import { DrawIcon } from "../components/DrawIcon";
import { useEnter } from "../components/anim";
import { KineticText } from "../components/Text";
import type { SceneProps } from "./common";

/** Smaller type for longer titles, so even a long one stays above the rule and subtitle. */
export function titleSize(title: string): number {
  const n = title.trim().length;
  return n <= 24 ? 96 : n <= 40 ? 80 : n <= 60 ? 66 : 56;
}

export const TitleScene: React.FC<SceneProps<T>> = ({ scene }) => {
  const disc = useEnter(0, 18);
  const sub = useEnter(22, 20);
  const rule = useEnter(18, 22);
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 420,
          width: 420,
          height: 420,
          borderRadius: 210,
          background: "rgba(47,125,225,0.10)",
          transform: `scale(${0.7 + 0.3 * disc})`,
          opacity: disc,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {scene.icon && <DrawIcon name={scene.icon} size={230} at={6} drawFrames={34} strokeWidth={1.4} />}
      </div>
      <div
        style={{
          position: "absolute",
          top: 930,
          left: 80,
          right: 80,
          textAlign: "center",
          isolation: "isolate",
        }}
      >
        <KineticText text={scene.title} at={10} size={titleSize(scene.title)} letterSpacing={-2} lineHeight={1.08} stagger={4} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 1175,
          height: 8,
          width: 160 * rule,
          borderRadius: 4,
          background: theme.accent,
        }}
      />
      {scene.subtitle && (
        <div
          style={{
            position: "absolute",
            top: 1215,
            left: 120,
            right: 120,
            textAlign: "center",
            fontFamily: theme.font,
            fontWeight: 500,
            fontSize: 42,
            color: theme.muted,
            opacity: sub,
          }}
        >
          {scene.subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
