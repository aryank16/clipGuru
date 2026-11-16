import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../theme";

// Subtle living background: a faint dot grid that drifts, and two soft
// accent glows that slowly float. Keeps the frame calm but never static.
export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const drift = (f * 0.25) % 48;
  const g1x = 160 + Math.sin(f / 90) * 80;
  const g1y = 420 + Math.cos(f / 110) * 60;
  const g2x = 920 + Math.cos(f / 100) * 70;
  const g2y = 1500 + Math.sin(f / 80) * 70;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${theme.line} 2.2px, transparent 2.4px)`,
          backgroundSize: "48px 48px",
          backgroundPosition: `${drift}px ${drift}px`,
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: g1x - 360,
          top: g1y - 360,
          width: 720,
          height: 720,
          borderRadius: 360,
          background: "radial-gradient(circle, rgba(47,125,225,0.10) 0%, rgba(47,125,225,0) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: g2x - 400,
          top: g2y - 400,
          width: 800,
          height: 800,
          borderRadius: 400,
          background: "radial-gradient(circle, rgba(47,125,225,0.08) 0%, rgba(47,125,225,0) 70%)",
        }}
      />
    </AbsoluteFill>
  );
};
