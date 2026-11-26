import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import type { StatScene as T } from "../types";
import { theme } from "../theme";
import { DrawIcon } from "../components/DrawIcon";
import { Label } from "../components/Text";
import { useEnter } from "../components/anim";
import { useCueFrames, type SceneProps } from "./common";

// Big number that counts up when its cue word is spoken.
export const StatScene: React.FC<SceneProps<T>> = ({ scene, timing }) => {
  const frame = useCurrentFrame();
  const [cueAt] = useCueFrames(timing, [scene.cue ?? scene.value]);
  const at = Math.min(cueAt, 20);
  const m = scene.value.match(/^([^0-9]*)([0-9][0-9,.]*)(.*)$/);
  let shown = scene.value;
  if (m) {
    const target = parseFloat(m[2].replace(/,/g, ""));
    const decimals = (m[2].split(".")[1] ?? "").length;
    const v = interpolate(frame, [at, at + 30], [0, target], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    const num = v.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    shown = `${m[1]}${num}${m[3]}`;
  }
  const p = useEnter(at, 14);
  // A percentage also fills a bar, in step with the count.
  const pctMatch = scene.value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*%$/);
  const pct = pctMatch ? Math.min(100, parseFloat(pctMatch[1])) : null;
  const fill = interpolate(frame, [at, at + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  // Centre the block in the visual zone whether or not there is an icon.
  const dy = scene.icon ? 30 : -60;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      {scene.icon && (
        <div style={{ position: "absolute", top: 450 + dy }}>
          <DrawIcon name={scene.icon} size={170} at={2} color={theme.accent} strokeWidth={1.5} />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: 660 + dy,
          fontFamily: theme.font,
          fontWeight: 700,
          fontSize: statSize(scene.value),
          letterSpacing: -6,
          whiteSpace: "nowrap",
          color: theme.accent,
          opacity: p,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {shown}
      </div>
      {pct !== null && (
        <div style={{ position: "absolute", top: 955 + dy, left: 190, right: 190, height: 22, borderRadius: 11, background: theme.line, opacity: p }}>
          <div
            style={{
              height: "100%",
              width: `${pct * fill}%`,
              borderRadius: 11,
              background: theme.accent,
              boxShadow: "0 0 18px rgba(47,125,225,0.5)",
            }}
          />
        </div>
      )}
      <div style={{ position: "absolute", top: (pct !== null ? 1010 : 980) + dy, left: 110, right: 110, textAlign: "center" }}>
        <Label text={scene.label} at={at + 10} size={52} />
      </div>
    </AbsoluteFill>
  );
};

/** The big number at 230 px, shrunk so a longer value like "149.6M km" still fits on one line. */
export function statSize(value: string): number {
  return Math.max(110, Math.min(230, Math.floor(1000 / (Math.max(1, value.length) * 0.6))));
}
