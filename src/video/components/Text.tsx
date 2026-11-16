import React from "react";
import { theme, zones } from "../theme";
import { useEnter } from "./anim";

// Heading that rises in, with a short accent rule drawn underneath.
export const Heading: React.FC<{ text: string; at?: number; size?: number }> = ({
  text,
  at = 0,
  size = 72,
}) => {
  const p = useEnter(at, 20);
  const rule = useEnter(at + 8, 18);
  return (
    <div
      style={{
        position: "absolute",
        top: zones.headingY,
        left: 90,
        right: 90,
        textAlign: "center",
        opacity: p,
        transform: `translateY(${(1 - p) * 30}px)`,
      }}
    >
      <div
        style={{
          fontFamily: theme.font,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.12,
          color: theme.ink,
          letterSpacing: -1,
        }}
      >
        {text}
      </div>
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
        ...style,
      }}
    >
      {text}
    </div>
  );
};
