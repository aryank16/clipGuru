import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, PALE, Studio } from "./studio";

const COLORS = [PALE, "#9CC2F2", "#1F2328", "#E8C547"];

/** Bodies circle a glowing centre; body i joins its orbit on cue i. */
export const Orbit: React.FC<{ cues: number[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = cues.length;
  const radii = cues.map((_, i) => 1.7 + i * (n > 3 ? 0.85 : 1.05));
  const camera = (f: number) => {
    const a = f / 260;
    const r = 5.8 + radii[n - 1] * 0.85;
    return { pos: [Math.sin(a) * r, r * 0.55, Math.cos(a) * r] as [number, number, number], look: [0, 0.2, 0] as [number, number, number] };
  };
  const core = spring({ frame, fps, config: { damping: 12 } });
  return (
    <Studio camera={camera} floorY={-2.4}>
      <mesh scale={0.2 + 0.8 * core} castShadow>
        <sphereGeometry args={[0.85, 48, 48]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.35} roughness={0.35} />
      </mesh>
      <pointLight color={ACCENT} intensity={6} distance={6} />
      {radii.map((r, i) => {
        const p = spring({ frame: frame - cues[i], fps, config: { damping: 11, mass: 0.7 } });
        if (frame < cues[i] - 2) return null;
        const speed = 0.9 / Math.pow(r, 1.5);
        const a = (frame - cues[i]) * speed * 0.35 + i * 1.9;
        return (
          <group key={i} rotation={[0.18 * (i % 2 ? 1 : -1), 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r, 0.012, 8, 160]} />
              <meshBasicMaterial color={ACCENT} transparent opacity={0.45 * Math.min(1, p)} />
            </mesh>
            <mesh position={[Math.cos(a) * r, 0, Math.sin(a) * r]} scale={Math.max(0.001, p)} castShadow>
              <sphereGeometry args={[0.24 + (i % 2) * 0.06, 32, 32]} />
              <meshStandardMaterial color={COLORS[i % COLORS.length]} roughness={0.3} metalness={0.1} />
            </mesh>
          </group>
        );
      })}
    </Studio>
  );
};
