import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { Glow } from "./cinema";
import { rng, type Vec3 } from "./studio";
import type { ModelProps } from "./models";

/**
 * A bullet crossing the path of a moving car, in bullet time. Everything is filmed from the car's
 * point of view: the car stays put and the highway streams past. On the first cue time slows almost
 * to a stop and the bullet drifts in; it punches in through the near door and out of the far one
 * (its path through the car is diagonal, because the car keeps moving while it crosses), metal flies
 * out behind, and time speeds back up as the car drives on. No people: it's a physics shot.
 */

const CAR_V = 0.6; // highway units per (simulated) frame
const BULLET_V = 1.25;
const HALF_W = 0.9;
/** The door skin sits this far out from the body block (the extrusion's bevel). */
const SKIN = 0.06;
const ENTRY: Vec3 = [0.35, 0.72, HALF_W + SKIN];
const START_Z = 4.5;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Simulated time for every frame of the scene, with the slow-motion window bent in. Time slows on
 * the first cue; the bullet then sets off, timed (by how slow time runs) to hit on the second cue;
 * time speeds up again on the third cue, or a moment after the bullet is out if that's later.
 */
export function timeline(frames: number, cues: number[]) {
  const fire = cues[0] ?? 45;
  const launch = fire + 10;
  const hitWanted = Math.max(launch + 30, cues[1] ?? launch + 60);
  const toHit = (START_Z - HALF_W - SKIN) / BULLET_V;
  const crossing = (2 * (HALF_W + SKIN)) / BULLET_V;
  const slow = Math.min(0.2, Math.max(0.015, toHit / (hitWanted - launch)));
  const sim: number[] = [0];
  let fireSim = Infinity;
  let backAt = Infinity;
  let exitFrame = Infinity;
  for (let f = 1; f <= frames + 40; f++) {
    if (f - 1 === launch) fireSim = sim[f - 1];
    if (backAt === Infinity && sim[f - 1] - fireSim >= toHit + crossing) {
      exitFrame = f - 1;
      // Hold bullet time long enough for the X-ray view of the path (below).
      backAt = Math.max(f - 1 + 110, cues[2] ?? 0);
    }
    const down = interpolate(f, [fire - 4, fire + 10], [1, slow], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const up = backAt === Infinity ? 0 : interpolate(f, [backAt, backAt + 20], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
    sim.push(sim[f - 1] + down + (1 - down) * up);
  }
  return { sim, fire, toHit, fireSim: fireSim === Infinity ? 1e9 : fireSim, backAt: backAt === Infinity ? frames + 100 : backAt, exitFrame: exitFrame === Infinity ? frames + 100 : exitFrame };
}

/** Where the bullet is, in the car's frame, at simulated time t (null before it's fired). */
function bulletAt(t: number, fireSim: number): THREE.Vector3 | null {
  const since = t - fireSim;
  if (since < 0) return null;
  const z = START_Z - BULLET_V * since;
  const tHit = (START_Z - HALF_W - SKIN) / BULLET_V;
  // The world slides backwards past the car, so the bullet does too.
  const x = ENTRY[0] - CAR_V * (since - tHit);
  return new THREE.Vector3(x, ENTRY[1], z);
}

// --- the car -----------------------------------------------------------------------------------
const lower = (() => {
  const s = new THREE.Shape();
  s.moveTo(-2.15, 0.28);
  s.lineTo(2.1, 0.28);
  s.quadraticCurveTo(2.3, 0.3, 2.28, 0.62);
  s.quadraticCurveTo(2.25, 0.86, 1.9, 0.92);
  s.lineTo(0.75, 1.0);
  s.lineTo(-1.75, 1.0);
  s.quadraticCurveTo(-2.2, 0.98, -2.22, 0.7);
  s.lineTo(-2.15, 0.28);
  return s;
})();
const cabin = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.78, 0.98);
  s.quadraticCurveTo(0.35, 1.32, 0.0, 1.43);
  s.lineTo(-1.05, 1.43);
  s.quadraticCurveTo(-1.55, 1.3, -1.78, 0.98);
  s.lineTo(0.78, 0.98);
  return s;
})();
const roof = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.02, 1.42);
  s.lineTo(-1.07, 1.42);
  s.lineTo(-1.07, 1.5);
  s.quadraticCurveTo(-0.5, 1.53, 0.02, 1.5);
  s.lineTo(0.02, 1.42);
  return s;
})();

const paint = { color: theme.accent, roughness: 0.22, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 };

const Wheel: React.FC<{ x: number; z: number; spin: number }> = ({ x, z, spin }) => {
  const out = z > 0 ? 1 : -1;
  return (
    <group position={[x, 0.36, z]}>
      {/* the dark wheel arch in the body side */}
      <mesh position={[0, 0.02, out * 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.06, 40]} />
        <meshStandardMaterial color="#15171B" roughness={0.9} />
      </mesh>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <group rotation={[0, spin, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.26, 48]} />
            <meshStandardMaterial color="#202226" roughness={0.8} />
          </mesh>
          <mesh position={[0, -out * 0.132, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.01, 40]} />
            <meshStandardMaterial color="#5E646C" metalness={1} roughness={0.3} />
          </mesh>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[0, -out * 0.14, 0]} rotation={[0, (k * Math.PI * 2) / 5, 0]}>
              <boxGeometry args={[0.05, 0.02, 0.44]} />
              <meshStandardMaterial color="#D5DAE0" metalness={1} roughness={0.18} />
            </mesh>
          ))}
          <mesh position={[0, -out * 0.15, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.03, 24]} />
            <meshStandardMaterial color="#D5DAE0" metalness={1} roughness={0.18} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

/** A hole punched through a door panel: dark centre, a ring of bent bright metal round it. */
const Hole: React.FC<{ at: Vec3; side: 1 | -1; p: number }> = ({ at, side, p }) => (
  <group position={[at[0], at[1], at[2] + side * 0.012]} rotation={[0, side > 0 ? 0 : Math.PI, 0]} scale={p}>
    <mesh>
      <circleGeometry args={[0.07, 32]} />
      <meshBasicMaterial color="#0E0F12" />
    </mesh>
    <mesh>
      <torusGeometry args={[0.085, 0.022, 10, 32]} />
      <meshStandardMaterial color="#D8DDE3" metalness={1} roughness={0.25} />
    </mesh>
  </group>
);

// --- the scene ---------------------------------------------------------------------------------
export const Highway: React.FC<ModelProps> = ({ cues, frames }) => {
  const f = useCurrentFrame();
  const tl = useMemo(() => timeline(frames, cues), [frames, cues]);
  const fire = tl.fire;
  const t = tl.sim[Math.min(f, tl.sim.length - 1)];
  const dist = CAR_V * t;
  const bullet = bulletAt(t, tl.fireSim);
  const tHit = tl.fireSim + (START_Z - HALF_W - SKIN) / BULLET_V;
  const tExit = tHit + (2 * (HALF_W + SKIN)) / BULLET_V;
  const exitPt: Vec3 = [ENTRY[0] - CAR_V * (tExit - tHit), ENTRY[1], -HALF_W - SKIN];

  // Debris: torn metal and paint flakes thrown out of the exit hole; it falls behind the car as the
  // world carries it away. Seeded, so every render is the same.
  const r = useMemo(() => rng(21), []);
  const debris = useMemo(
    () =>
      Array.from({ length: 34 }, () => ({
        v: new THREE.Vector3((r() - 0.5) * 0.12, (r() - 0.2) * 0.1, -0.12 - r() * 0.22),
        spin: new THREE.Vector3(r() * 0.5, r() * 0.5, r() * 0.5),
        size: 0.025 + r() * 0.05,
        metal: r() > 0.35,
      })),
    [r],
  );
  const sparks = useMemo(() => Array.from({ length: 14 }, () => new THREE.Vector3(r() - 0.5, r() * 0.8, 0.4 + r()).normalize()), [r]);

  // Camera: alongside the car at speed; in bullet time it swings in low behind the bullet's path
  // and watches it hit; then it pulls back wide as time speeds up again.
  const { camera } = useThree();
  const slowIn = interpolate(f, [fire - 10, fire + 30], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const slowOut = interpolate(f, [tl.backAt - 10, tl.backAt + 30], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  // Once the bullet is out, the camera rises over the roof and the car turns see-through (X-ray), so
  // the slanted path through it shows.
  const xray = interpolate(f, [tl.exitFrame + 4, tl.exitFrame + 30], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const shake = (1 - slowIn + slowOut) * 0.03;
  const wide = new THREE.Vector3(5.2, 1.5, 7.4);
  const close = new THREE.Vector3(2.8, 1.25, 5.7);
  const after = new THREE.Vector3(-4.6, 2.4, 8.6);
  const top = new THREE.Vector3(1.0, 7.6, 3.6);
  const pos = wide.clone().lerp(close, slowIn).lerp(top, xray * (1 - slowOut)).lerp(after, slowOut);
  pos.x += Math.sin(f * 1.7) * shake;
  pos.y += Math.cos(f * 2.3) * shake;
  // Slowly creep round the entry point while time is frozen.
  pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), slowIn * (1 - slowOut) * interpolate(f, [fire, tl.backAt], [0.0, -0.35], clamp));
  const look = new THREE.Vector3(0, 0.75, 0)
    .lerp(new THREE.Vector3(...ENTRY), slowIn * (1 - slowOut) * (1 - xray))
    .lerp(new THREE.Vector3(-0.1, 0.6, 0), xray * (1 - slowOut));
  const ghost = { transparent: true, opacity: 1 - 0.78 * xray, depthWrite: xray < 0.5 };
  camera.position.copy(pos);
  camera.lookAt(look);

  const spin = -dist / 0.36;
  const dash = 3;
  const offset = ((dist % (dash * 2)) + dash * 2) % (dash * 2);
  // At speed the lane dashes smear a little; in bullet time they sharpen.
  const speedNow = tl.sim[Math.min(f + 1, tl.sim.length - 1)] - t;
  const smear = 1 + 0.6 * speedNow;

  return (
    <group>
      {/* the road and its markings, streaming past */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[220, 12]} />
        <meshStandardMaterial color="#5A5E66" roughness={0.92} />
      </mesh>
      {Array.from({ length: 34 }, (_, i) => {
        const x = -60 + i * dash * 2 - offset;
        return (
          <group key={i}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.004, 2.4]} scale={[smear, 1, 1]}>
              <planeGeometry args={[dash * 0.6, 0.14]} />
              <meshStandardMaterial color="#F4F1EA" roughness={0.6} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x + dash, 0.004, -2.4]} scale={[smear, 1, 1]}>
              <planeGeometry args={[dash * 0.6, 0.14]} />
              <meshStandardMaterial color="#F4F1EA" roughness={0.6} />
            </mesh>
            {/* guardrail posts */}
            <mesh position={[x, 0.4, -6.2]} castShadow>
              <boxGeometry args={[0.12, 0.8, 0.12]} />
              <meshStandardMaterial color="#AEB4BC" metalness={0.8} roughness={0.35} />
            </mesh>
          </group>
        );
      })}
      {[-5.8, 5.8].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, z]}>
          <planeGeometry args={[220, 0.16]} />
          <meshStandardMaterial color="#E8C547" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.72, -6.2]}>
        <boxGeometry args={[220, 0.32, 0.06]} />
        <meshStandardMaterial color="#C9CED6" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* the car */}
      <group>
        <mesh position={[0, 0, -HALF_W]} castShadow>
          <extrudeGeometry args={[lower, { depth: 2 * HALF_W, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 4, curveSegments: 16 }]} />
          <meshPhysicalMaterial {...paint} {...ghost} />
        </mesh>
        <mesh position={[0, 0, -HALF_W + 0.12]} castShadow>
          <extrudeGeometry args={[cabin, { depth: 2 * HALF_W - 0.24, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3, curveSegments: 16 }]} />
          <meshPhysicalMaterial color="#33435A" roughness={0.04} metalness={0.6} clearcoat={1} {...ghost} />
        </mesh>
        <mesh position={[0, 0, -HALF_W + 0.1]} castShadow>
          <extrudeGeometry args={[roof, { depth: 2 * HALF_W - 0.2, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 }]} />
          <meshPhysicalMaterial {...paint} {...ghost} />
        </mesh>
        {/* B-pillar, chrome beltline and a dark side skirt on each side */}
        {[1, -1].map((side) => (
          <group key={side}>
            <mesh position={[-0.42, 1.2, side * (HALF_W - 0.06)]}>
              <boxGeometry args={[0.1, 0.46, 0.04]} />
              <meshStandardMaterial color="#1A1D22" roughness={0.4} />
            </mesh>
            <mesh position={[-0.5, 0.99, side * (HALF_W + 0.055)]}>
              <boxGeometry args={[2.5, 0.025, 0.012]} />
              <meshStandardMaterial color="#E4E8ED" metalness={1} roughness={0.12} />
            </mesh>
          </group>
        ))}
        {[-0.62, 0.62].map((z) => (
          <group key={z}>
            <mesh position={[2.27, 0.72, z]}>
              <boxGeometry args={[0.06, 0.12, 0.34]} />
              <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
            </mesh>
            <mesh position={[-2.24, 0.78, z]}>
              <boxGeometry args={[0.06, 0.1, 0.3]} />
              <meshBasicMaterial color="#FF4D4D" toneMapped={false} />
            </mesh>
          </group>
        ))}
        {[1.38, -1.4].map((x) => [HALF_W - 0.02, -HALF_W + 0.02].map((z) => <Wheel key={`${x}${z}`} x={x} z={z} spin={spin} />))}
        {t >= tHit && (() => {
          // The bullet's path through the car, drawn as it goes: entry to exit, slanted.
          const k = Math.min(1, (t - tHit) / (tExit - tHit));
          const a = new THREE.Vector3(...ENTRY);
          const b = a.clone().lerp(new THREE.Vector3(...exitPt), k);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          const len = a.distanceTo(b);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          return len > 0.01 ? (
            <mesh position={mid} quaternion={q}>
              <cylinderGeometry args={[0.025, 0.025, len, 12]} />
              <meshBasicMaterial color="#FF5A3C" toneMapped={false} transparent opacity={0.35 + 0.65 * xray} />
            </mesh>
          ) : null;
        })()}
        {/* for comparison: the straight path it would take through a parked car */}
        {xray > 0 && (
          <mesh position={[ENTRY[0], ENTRY[1], 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 2 * (HALF_W + SKIN), 8]} />
            <meshBasicMaterial color="#FFFFFF" transparent opacity={0.8 * xray} toneMapped={false} />
          </mesh>
        )}
        {t >= tHit && <Hole at={ENTRY} side={1} p={interpolate(t - tHit, [0, 0.3], [0.3, 1], clamp)} />}
        {t >= tExit && <Hole at={exitPt} side={-1} p={interpolate(t - tExit, [0, 0.3], [0.4, 1.25], clamp)} />}
      </group>

      {/* the bullet, with its shock ring and a fading vapour trail */}
      {bullet && bullet.z > -7 && (
        <group position={bullet} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.035, 0.035, 0.14, 24]} />
            <meshStandardMaterial color="#C8873E" metalness={1} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.115, 0]}>
            <coneGeometry args={[0.035, 0.09, 24]} />
            <meshStandardMaterial color="#D79A4E" metalness={1} roughness={0.18} />
          </mesh>
          {/* the shock wave: a faint cone of compressed air ahead of the tip */}
          <mesh position={[0, -0.05, 0]}>
            <coneGeometry args={[0.15, 0.36, 40, 1, true]} />
            <meshBasicMaterial color="#FFFFFF" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* vapour trail behind it, along the path it came by */}
          <mesh position={[0, -0.9, 0]}>
            <cylinderGeometry args={[0.012, 0.03, 1.6, 12, 1, true]} />
            <meshBasicMaterial color="#FFFFFF" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* sparks and a flash where it goes in */}
      {t >= tHit &&
        t < tHit + 2.2 &&
        sparks.map((d, i) => {
          const age = t - tHit;
          const p = new THREE.Vector3(...ENTRY).addScaledVector(d, age * (0.18 + (i % 4) * 0.04));
          return (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.014, 6, 6]} />
              <meshBasicMaterial color="#FFE2A8" toneMapped={false} transparent opacity={1 - age / 2.2} />
            </mesh>
          );
        })}
      {t >= tHit && t < tHit + 1.4 && <Glow color="#FFD58A" size={0.5 * (1 - (t - tHit) / 1.4) + 0.12} opacity={0.75} position={[ENTRY[0], ENTRY[1], ENTRY[2] + 0.05]} />}

      {/* torn metal thrown out of the far side */}
      {t >= tExit &&
        debris.map((d, i) => {
          const age = t - tExit;
          // Thrown with the bullet, slowed by air, pulled down by gravity, and left behind by the car.
          const p = new THREE.Vector3(...exitPt)
            .addScaledVector(d.v, age)
            .add(new THREE.Vector3(-CAR_V * age * 0.5, -0.004 * age * age, 0));
          if (p.y < 0.02) p.y = 0.02;
          return (
            <mesh key={i} position={p} rotation={[d.spin.x * age, d.spin.y * age, d.spin.z * age]} castShadow>
              <boxGeometry args={[d.size, d.size * 0.15, d.size * 0.8]} />
              <meshStandardMaterial color={d.metal ? "#C9CED6" : theme.accent} metalness={d.metal ? 1 : 0.3} roughness={0.3} />
            </mesh>
          );
        })}
    </group>
  );
};
