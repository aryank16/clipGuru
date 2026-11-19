import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, rng, SKY, Studio } from "./studio";

const W = 2.2;
const H = 2.9;
const COLS = 6;
const ROWS = 8;
const HIT_Y = 1.45;
const G = -9.8;
const SLOW = 0.55; // shards fall in gentle slow motion

type Shard = { z0: number; y0: number; vx: number; vy: number; vz: number; r: [number, number, number]; w: number; h: number };

function shards(seed: number): Shard[] {
  const r = rng(seed);
  const out: Shard[] = [];
  const cw = W / COLS;
  const ch = H / ROWS;
  for (let c = 0; c < COLS; c++)
    for (let k = 0; k < ROWS; k++) {
      const z0 = -W / 2 + cw * (c + 0.5);
      const y0 = ch * (k + 0.5);
      const dy = y0 - HIT_Y;
      const d = Math.hypot(z0, dy) + 0.25;
      const burst = 2 / d;
      out.push({
        z0,
        y0,
        vx: 1 + (r() * 2.4) / d,
        vy: (dy / d) * burst + r() * 1.4,
        vz: (z0 / d) * burst + (r() - 0.5),
        r: [(r() - 0.5) * 12, (r() - 0.5) * 12, (r() - 0.5) * 12],
        w: cw * (0.6 + r() * 0.5),
        h: ch * (0.6 + r() * 0.5),
      });
    }
  return out;
}

/** An object smashes through one panel per item, each on its cue word. */
export const Impact: React.FC<{ cues: number[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = cues.length;
  const gap = 2;
  const xs = cues.map((_, i) => (i - (n - 1) / 2) * gap);
  const pieces = useMemo(() => cues.map((_, i) => shards(31 + i * 977)), [cues]);

  // The projectile reaches panel i exactly on cue i, then flies on.
  const keysF = [Math.max(0, cues[0] - 40), ...cues, cues[n - 1] + 40];
  const keysX = [xs[0] - 5, ...xs, xs[n - 1] + 6];
  const bx = interpolate(frame, keysF, keysX, { extrapolateLeft: "clamp", extrapolateRight: "extend" });

  const span = (n - 1) * gap;
  const camera = (f: number) => {
    const a = interpolate(f, [0, 300], [-0.85, -0.45], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
    const radius = 7 + span * 0.8;
    return { pos: [Math.sin(a) * radius, 2.4 + Math.sin(f / 50) * 0.1, Math.cos(a) * radius] as [number, number, number], look: [0, 1.3, 0] as [number, number, number] };
  };

  return (
    <Studio camera={camera}>
      {xs.map((x, i) => {
        if (frame < cues[i]) {
          return (
            <mesh key={i} position={[x, H / 2, 0]} castShadow>
              <boxGeometry args={[0.06, H, W]} />
              <meshStandardMaterial color={i === n - 1 ? ACCENT : SKY} transparent opacity={0.7} roughness={0.08} metalness={0.15} />
            </mesh>
          );
        }
        const dt = ((frame - cues[i]) / fps) * SLOW;
        return (
          <group key={i}>
            {pieces[i].map((s, k) => {
              const y = Math.max(s.h / 2, s.y0 + s.vy * dt + 0.5 * G * dt * dt);
              const spin = y <= s.h / 2 + 0.001 ? Math.min(dt, 0.6) : dt;
              return (
                <mesh key={k} position={[x + s.vx * dt, y, s.z0 + s.vz * dt]} rotation={[s.r[0] * spin, s.r[1] * spin, s.r[2] * spin]} castShadow>
                  <boxGeometry args={[0.05, s.h, s.w]} />
                  <meshStandardMaterial color={i === n - 1 ? ACCENT : SKY} transparent opacity={0.8} roughness={0.1} metalness={0.2} />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {bx < xs[n - 1] + 6 && (
        <group position={[bx, HIT_Y, 0]}>
          <mesh rotation={[0, 0, -Math.PI / 2]} castShadow>
            <capsuleGeometry args={[0.15, 0.45, 8, 24]} />
            <meshStandardMaterial color="#1F2328" metalness={0.7} roughness={0.25} />
          </mesh>
          {[1, 2, 3].map((k) => (
            <mesh key={k} position={[-k * 0.32, 0, 0]}>
              <sphereGeometry args={[0.11 - k * 0.025, 12, 12]} />
              <meshBasicMaterial color={ACCENT} transparent opacity={0.3 - k * 0.08} />
            </mesh>
          ))}
        </group>
      )}
    </Studio>
  );
};
