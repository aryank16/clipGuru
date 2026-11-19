import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, PALE, SKY, Studio } from "./studio";

const G = 18;
const DROP = 7;
const SIZES = [2.2, 1.85, 1.5, 1.15];
const HEIGHTS = [0.85, 0.8, 0.75, 0.7];
const COLORS = [ACCENT, PALE, SKY, "#9CC2F2"];

/** Height above rest of a block dropped from DROP, with a few damped bounces. */
function fall(t: number): number {
  if (t <= 0) return DROP;
  const t1 = Math.sqrt((2 * DROP) / G);
  if (t < t1) return DROP - 0.5 * G * t * t;
  let rest = t - t1;
  let v = G * t1 * 0.32;
  for (let k = 0; k < 3; k++) {
    const period = (2 * v) / G;
    if (rest < period) return v * rest - 0.5 * G * rest * rest;
    rest -= period;
    v *= 0.32;
  }
  return 0;
}

/** Blocks drop one per cue and stack into a tower, with a puff of dust as each lands. */
export const Stack: React.FC<{ cues: number[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tops = HEIGHTS.reduce<number[]>((a, h, i) => [...a, (a[i - 1] ?? 0) + (i ? HEIGHTS[i - 1] : 0)], []);
  const camera = (f: number) => {
    const a = -0.6 + f / 420;
    // Rise smoothly with the tower: a little after each block lands.
    const lookY = 0.6 + cues.reduce((y, c) => y + interpolate(f, [c, c + 24], [0, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0);
    return { pos: [Math.sin(a) * 7.6, 3.2 + lookY * 0.5, Math.cos(a) * 7.6] as [number, number, number], look: [0, lookY, 0] as [number, number, number] };
  };
  return (
    <Studio camera={camera}>
      {cues.map((c, i) => {
        // Start falling just before the cue, so it lands on the word.
        const t1 = Math.sqrt((2 * DROP) / G);
        const t = (frame - c) / fps + t1;
        if (t <= 0) return null;
        const y = tops[i] + HEIGHTS[i] / 2 + fall(t);
        const since = (frame - c) / fps;
        const dust = since > 0 && since < 0.8 ? since / 0.8 : -1;
        return (
          <group key={i}>
            <mesh position={[0, y, 0]} rotation={[0, i * 0.35, 0]} castShadow receiveShadow>
              <boxGeometry args={[SIZES[i], HEIGHTS[i], SIZES[i]]} />
              <meshStandardMaterial color={COLORS[i % COLORS.length]} roughness={0.35} metalness={0.05} />
            </mesh>
            {dust >= 0 && (
              <mesh position={[0, tops[i] + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} scale={1 + dust * 1.6}>
                <torusGeometry args={[SIZES[i] * 0.75, 0.05, 8, 64]} />
                <meshBasicMaterial color="#C9C2B6" transparent opacity={(1 - dust) * 0.7} />
              </mesh>
            )}
          </group>
        );
      })}
    </Studio>
  );
};
