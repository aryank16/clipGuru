import React from "react";
import { theme, zones } from "../theme";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useEnter } from "./anim";

/** The word to mark in a heading: the longest one (ties go to the later word). */
export function keyWordIndex(words: string[]): number {
  let best = -1;
  words.forEach((w, i) => {
    const n = w.replace(/[^\p{L}\p{N}]/gu, "").length;
    if (n >= 4 && (best < 0 || n >= words[best].replace(/[^\p{L}\p{N}]/gu, "").length)) best = i;
  });
  return best;
}

/**
 * Text that builds word by word: each word springs up out of a soft blur, then the key word
 * gets an accent highlighter swept behind it.
 */
export const KineticText: React.FC<{
  text: string;
  at?: number;
  size: number;
  weight?: number;
  color?: string;
  lineHeight?: number;
  letterSpacing?: number;
  stagger?: number;
  highlight?: boolean;
}> = ({ text, at = 0, size, weight = 700, color = theme.ink, lineHeight = 1.12, letterSpacing = -1, stagger = 3, highlight = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  const key = highlight ? keyWordIndex(words) : -1;
  const markAt = at + words.length * stagger + 8;
  const mark = interpolate(frame, [markAt, markAt + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  return (
    <div style={{ fontFamily: theme.font, fontWeight: weight, fontSize: size, lineHeight, color, letterSpacing }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - at - i * stagger, fps, config: { damping: 15, mass: 0.6, stiffness: 140 } });
        const o = Math.min(1, Math.max(0, s * 1.4));
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: "inline-block",
                position: "relative",
                opacity: o,
                transform: `translateY(${(1 - s) * size * 0.55}px) scale(${0.92 + 0.08 * s})`,
                filter: s < 0.95 ? `blur(${((1 - Math.min(1, s)) * 8).toFixed(1)}px)` : undefined,
              }}
            >
              {i === key && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: -size * 0.08,
                    right: -size * 0.08,
                    bottom: size * 0.06,
                    height: size * 0.36,
                    borderRadius: size * 0.08,
                    background: "rgba(47,125,225,0.22)",
                    transform: `scaleX(${mark})`,
                    transformOrigin: "left center",
                    zIndex: -1,
                  }}
                />
              )}
              {w}
            </span>
            {i < words.length - 1 ? " " : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Heading that builds word by word, with a short accent rule drawn underneath.
export const Heading: React.FC<{ text: string; at?: number; size?: number }> = ({
  text,
  at = 0,
  size = 72,
}) => {
  const rule = useEnter(at + 10, 18);
  return (
    <div
      style={{
        position: "absolute",
        top: zones.headingY,
        left: 90,
        right: 90,
        textAlign: "center",
        isolation: "isolate",
      }}
    >
      <KineticText text={text} at={at} size={size} />
      <div
        style={{
          margin: "28px auto 0",
          height: 8,
          width: 120 * rule,
          borderRadius: 4,
          background: theme.accent,
        }}
      />
    </div>
  );
};

export const Label: React.FC<{
  text: string;
  at: number;
  size?: number;
  weight?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ text, at, size = 40, weight = 600, color = theme.ink, style }) => {
  const p = useEnter(at, 16);
  return (
    <div
      style={{
        fontFamily: theme.font,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.2,
        color,
        opacity: p,
        transform: `translateY(${(1 - p) * 16}px)`,
        filter: p < 0.98 ? `blur(${((1 - p) * 6).toFixed(1)}px)` : undefined,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
