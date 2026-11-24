import React, { useMemo } from "react";
import * as THREE from "three";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Glow, useArrive } from "./cinema";
import { rng } from "./studio";
import type { ModelProps } from "./models";

/** More of the 3D model library (see models.tsx): brain, battery, phone, magnet, volcano, tree, lock, hourglass. */

const ACCENT = theme.accent;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const gloss = (color: string, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => ({
  color,
  roughness: 0.3,
  metalness: 0,
  clearcoat: 0.8,
  clearcoatRoughness: 0.15,
  ...extra,
});
/** How many cues have passed. */
const lit = (cues: number[], f: number) => cues.filter((c) => f >= c).length;
const cueAt = (cues: number[], i: number, fallback: number) => cues[Math.min(i, cues.length - 1)] ?? fallback;

// --- Brain -------------------------------------------------------------------------------------
/** A wrinkled sphere: the surface pushed in and out by a few crossing waves, like folds. */
function foldedHalf(side: 1 | -1) {
  const g = new THREE.SphereGeometry(1, 96, 72);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const folds = Math.sin(v.x * 9 + v.y * 4) * Math.sin(v.y * 8 - v.z * 6) * 0.045 + Math.sin(v.z * 13 + v.x * 5) * 0.025;
    v.multiplyScalar(1 + folds);
    // Hemisphere shape: longer front to back, flatter where the halves meet.
    v.set(v.x * 0.78 + side * 0.04, v.y * 0.88, v.z * 1.25);
    if (side * v.x < 0) v.x *= 0.35;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** A brain that slowly turns while signals race across it; each cue lights up a new region. */
export const Brain: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const halves = useMemo(() => [foldedHalf(-1), foldedHalf(1)], []);
  const r = useMemo(() => rng(17), []);
  const paths = useMemo(
    () =>
      Array.from({ length: 9 }, () => {
        const a = new THREE.Vector3(r() - 0.5, r() * 0.9 - 0.2, r() - 0.5).normalize();
        const b = new THREE.Vector3(r() - 0.5, r() * 0.9 - 0.2, r() - 0.5).normalize();
        return Array.from({ length: 24 }, (_, i) => {
          const t = i / 23;
          const d = a.clone().lerp(b, t).normalize();
          return new THREE.Vector3(d.x * 1.62, d.y * 0.98, d.z * 1.42);
        });
      }),
    [r],
  );
  const regions = [
    new THREE.Vector3(0.9, 0.55, 0.75),
    new THREE.Vector3(-0.85, 0.4, -0.7),
    new THREE.Vector3(0.3, 0.85, -0.3),
    new THREE.Vector3(-0.6, -0.2, 0.9),
  ];
  const n = lit(cues, f);
  const appear = useArrive(0, 26);
  return (
    <group rotation={[0.1, f * 0.01 - 0.6, 0]} scale={appear} position={[0, 0.2, 0]}>
      {halves.map((g, i) => (
        <mesh key={i} geometry={g} position={[i ? 0.42 : -0.42, 0, 0]} castShadow>
          <meshPhysicalMaterial {...gloss("#F2B8C0", { roughness: 0.45, clearcoat: 0.5 })} sheen={0.8} sheenColor="#FFD9DE" />
        </mesh>
      ))}
      {/* the brain stem */}
      <mesh position={[0, -1.05, -0.35]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.14, 0.9, 24]} />
        <meshPhysicalMaterial {...gloss("#E9A3AE", { roughness: 0.5 })} />
      </mesh>
      {/* signals: bright pulses running along paths over the surface */}
      {paths.map((pts, i) => {
        const period = 34 + (i % 4) * 7;
        const k = (((f + i * 11) % period) + period) % period / period;
        const at = pts[Math.min(pts.length - 1, Math.floor(k * pts.length))];
        return (
          <mesh key={i} position={at}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
          </mesh>
        );
      })}
      {regions.slice(0, Math.max(1, cues.length)).map((p, i) => {
        if (i >= n) return null;
        const pulse = 1 + 0.25 * Math.max(0, 1 - (f - cues[i]) / 16);
        return <Glow key={i} color={ACCENT} size={1.3 * pulse} opacity={0.75} position={[p.x, p.y, p.z]} />;
      })}
    </group>
  );
};

// --- Battery -----------------------------------------------------------------------------------
const boltShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.08, 0.5);
  s.lineTo(-0.22, -0.02);
  s.lineTo(-0.02, -0.02);
  s.lineTo(-0.1, -0.5);
  s.lineTo(0.22, 0.06);
  s.lineTo(0.02, 0.06);
  s.lineTo(0.08, 0.5);
  return s;
})();

/** A battery that charges up in steps, one per cue, with a bolt that lights when it's full. */
export const Battery: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const steps = Math.max(1, cues.length);
  const target = lit(cues, f) / steps;
  const prev = Math.max(0, lit(cues, f) - 1) / steps;
  const last = [...cues].reverse().find((c) => f >= c) ?? 0;
  const level = 0.08 + 0.92 * (prev + (target - prev) * interpolate(f, [last, last + 20], [0, 1], clamp));
  const full = level > 0.99;
  const H = 3;
  const col = level < 0.35 ? "#E8664A" : level < 0.7 ? "#E8C547" : "#4CC38A";
  return (
    <group rotation={[0.15, Math.sin(f / 70) * 0.5 + 0.3, 0.06]}>
      {/* glass case */}
      <mesh castShadow>
        <cylinderGeometry args={[0.95, 0.95, H, 64, 1, true]} />
        <meshPhysicalMaterial color="#FFFFFF" transparent opacity={0.28} roughness={0.05} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* the charge inside, rising */}
      <mesh position={[0, -H / 2 + (H * level) / 2, 0]} scale={[1, level, 1]}>
        <cylinderGeometry args={[0.86, 0.86, H, 64]} />
        <meshPhysicalMaterial {...gloss(col)} emissive={col} emissiveIntensity={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (s * H) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.99, 0.99, 0.22, 64]} />
          <meshStandardMaterial color="#C9CED6" metalness={1} roughness={0.22} />
        </mesh>
      ))}
      <mesh position={[0, H / 2 + 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.36, 0.26, 40]} />
        <meshStandardMaterial color="#C9CED6" metalness={1} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0, 1.0]} scale={1.6}>
        <extrudeGeometry args={[boltShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }]} />
        <meshStandardMaterial color={full ? "#FFF4C2" : "#FFFFFF"} emissive={full ? "#FFD34D" : "#000000"} emissiveIntensity={full ? 1.2 : 0} roughness={0.3} />
      </mesh>
      {full && <Glow color="#FFD34D" size={1.6 + Math.sin(f / 5) * 0.1} opacity={0.5} position={[0, 0, 1.2]} />}
    </group>
  );
};

// --- Phone -------------------------------------------------------------------------------------
function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

/** A phone that turns to face us and lights up; on each cue a card pops out of the screen in 3D. */
export const Phone: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const body = useMemo(() => roundedRect(1.9, 3.9, 0.32), []);
  const screen = useMemo(() => roundedRect(1.72, 3.7, 0.24), []);
  const card = useMemo(() => roundedRect(1.5, 0.5, 0.12), []);
  const turn = interpolate(f, [0, 40], [-0.9, -0.25], { ...clamp, easing: (t) => 1 - (1 - t) ** 3 });
  const on = interpolate(f, [10, 24], [0, 1], clamp);
  const colors = [ACCENT, "#4CC38A", "#F08A4B", "#9B7BE0"];
  return (
    <group rotation={[0.06, turn + Math.sin(f / 80) * 0.12, 0.04]} position={[0, 0.1, 0]}>
      <mesh position={[0, 0, -0.14]} castShadow>
        <extrudeGeometry args={[body, { depth: 0.22, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 6, curveSegments: 24 }]} />
        <meshPhysicalMaterial color="#2A2E35" metalness={0.7} roughness={0.25} clearcoat={1} />
      </mesh>
      <mesh position={[0, 0, 0.135]}>
        <shapeGeometry args={[screen, 24]} />
        <meshPhysicalMaterial color="#0F1115" emissive="#EAF2FD" emissiveIntensity={0.9 * on} roughness={0.05} clearcoat={1} />
      </mesh>
      {/* status bar and app rows */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[-0.15, 1.3 - i * 0.42, 0.14]} scale={[on, 1, 1]}>
          <planeGeometry args={[1.2 - (i % 2) * 0.3, 0.12]} />
          <meshBasicMaterial color="#C7D3E3" transparent opacity={0.9 * on} />
        </mesh>
      ))}
      {cues.slice(0, 4).map((c, i) => {
        const p = spring({ frame: f - c, fps, config: { damping: 12, mass: 0.7 } });
        if (f < c) return null;
        return (
          <group key={i} position={[0.15 * (i % 2 ? -1 : 1), 0.9 - i * 0.62, 0.2 + p * (0.7 + i * 0.12)]} scale={0.6 + 0.4 * p}>
            <mesh castShadow>
              <extrudeGeometry args={[card, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 }]} />
              <meshPhysicalMaterial {...gloss("#FFFFFF")} />
            </mesh>
            <mesh position={[-0.5, 0, 0.08]}>
              <circleGeometry args={[0.15, 32]} />
              <meshBasicMaterial color={colors[i % colors.length]} />
            </mesh>
            <mesh position={[0.15, 0.06, 0.08]}>
              <planeGeometry args={[0.85, 0.08]} />
              <meshBasicMaterial color="#AAB4C2" />
            </mesh>
            <mesh position={[0.05, -0.08, 0.08]}>
              <planeGeometry args={[0.65, 0.07]} />
              <meshBasicMaterial color="#D3DAE3" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// --- Magnet ------------------------------------------------------------------------------------
/** A horseshoe magnet: field lines bloom from its poles, and steel balls fly in and stick, one group per cue. */
export const Magnet: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shoe = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      if (t < 0.3) pts.push(new THREE.Vector3(-0.9, 1.6 - (t / 0.3) * 1.6, 0));
      else if (t < 0.7) {
        const a = Math.PI + ((t - 0.3) / 0.4) * Math.PI;
        pts.push(new THREE.Vector3(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0));
      } else pts.push(new THREE.Vector3(0.9, ((t - 0.7) / 0.3) * 1.6, 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.34, 32, false);
  }, []);
  const field = useMemo(
    () =>
      [0.7, 1.15, 1.6, 2.1].map((k) => {
        const pts = Array.from({ length: 40 }, (_, i) => {
          const a = (i / 39) * Math.PI;
          return new THREE.Vector3(-Math.cos(a) * (0.9 + 0.2 * k), 2.0 + Math.sin(a) * k, 0);
        });
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.018, 8, false);
      }),
    [],
  );
  const bloom = useArrive(cueAt(cues, 0, 20), 30);
  const r = useMemo(() => rng(4), []);
  const balls = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ side: i % 2 ? 1 : -1, from: new THREE.Vector3((r() - 0.5) * 6, 3 + r() * 2, (r() - 0.5) * 3), k: i })), [r]);
  return (
    <group position={[0, -0.9, 0]} rotation={[0, Math.sin(f / 80) * 0.5, 0]}>
      <mesh geometry={shoe} castShadow>
        <meshPhysicalMaterial {...gloss("#D9443A")} />
      </mesh>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 1.75, 0]} castShadow>
          <cylinderGeometry args={[0.345, 0.345, 0.3, 32]} />
          <meshStandardMaterial color="#D5DAE0" metalness={1} roughness={0.18} />
        </mesh>
      ))}
      {field.map((g, i) => (
        <mesh key={i} geometry={g} rotation={[0, (i - 1.5) * 0.35, 0]}>
          <meshBasicMaterial color={ACCENT} transparent opacity={0.55 * bloom * (1 - i * 0.12)} />
        </mesh>
      ))}
      {balls.map((b) => {
        const at = cueAt(cues, Math.floor((b.k / 12) * Math.max(1, cues.length)), 40) + (b.k % 4) * 3;
        if (f < at - 12) return null;
        const p = spring({ frame: f - at + 12, fps, config: { damping: 16, mass: 0.5 } });
        const stuck = new THREE.Vector3(b.side * 0.9 + (b.k % 3) * 0.12 - 0.12, 2.0 + Math.floor(b.k / 4) * 0.2, ((b.k % 4) - 1.5) * 0.14);
        const pos = b.from.clone().lerp(stuck, p);
        return (
          <mesh key={b.k} position={pos} castShadow>
            <sphereGeometry args={[0.11, 20, 20]} />
            <meshStandardMaterial color="#B9C0C9" metalness={1} roughness={0.15} />
          </mesh>
        );
      })}
    </group>
  );
};

// --- Volcano -----------------------------------------------------------------------------------
const coneProfile = (() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    pts.push(new THREE.Vector2(2.6 - t * 2.0 + Math.sin(t * 9) * 0.04, Math.pow(t, 0.85) * 2.3));
  }
  // down into the crater
  pts.push(new THREE.Vector2(0.45, 2.05));
  pts.push(new THREE.Vector2(0.001, 1.95));
  return pts;
})();

/** A volcano that rumbles, then erupts on a cue: lava bombs, smoke, and lava running down its sides. */
export const Volcano: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const erupt = cueAt(cues, cues.length > 1 ? 1 : 0, 40);
  const t = Math.max(0, f - erupt);
  const rumble = f < erupt ? Math.sin(f * 2.1) * 0.012 * interpolate(f, [erupt - 40, erupt], [0, 1], clamp) : 0;
  const r = useMemo(() => rng(9), []);
  const bombs = useMemo(() => Array.from({ length: 26 }, () => ({ a: r() * Math.PI * 2, v: 0.04 + r() * 0.05, up: 0.12 + r() * 0.08, d: r() * 30 })), [r]);
  const smoke = useMemo(() => Array.from({ length: 16 }, () => ({ x: (r() - 0.5) * 0.6, z: (r() - 0.5) * 0.6, d: r() * 60, s: 0.35 + r() * 0.4 })), [r]);
  const flows = useMemo(
    () =>
      [0.4, 2.2, 4.1].map((a) => {
        const pts = Array.from({ length: 20 }, (_, i) => {
          const k = i / 19;
          const rad = 0.55 + k * 1.9;
          const y = 2.1 - Math.pow(k, 1.1) * 2.05;
          const w = a + Math.sin(k * 6) * 0.08;
          return new THREE.Vector3(Math.cos(w) * rad, y + 0.03, Math.sin(w) * rad);
        });
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.07, 8, false);
      }),
    [],
  );
  const run = interpolate(t, [10, 70], [0, 1], clamp);
  return (
    <group position={[rumble, -1.7, 0]} rotation={[0, f * 0.004, 0]}>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[coneProfile, 72]} />
        <meshStandardMaterial color="#6B5446" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 2.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.46, 32]} />
        <meshBasicMaterial color="#FF7A2E" toneMapped={false} />
      </mesh>
      <Glow color="#FF8A3D" size={f >= erupt ? 2.4 : 1.2} opacity={0.6} position={[0, 2.2, 0]} />
      {f >= erupt &&
        flows.map((g, i) => (
          <mesh key={i} geometry={g} scale={1}>
            <meshBasicMaterial color="#FF6A1F" toneMapped={false} transparent opacity={run} />
          </mesh>
        ))}
      {f >= erupt &&
        bombs.map((b, i) => {
          const age = t - b.d * 0.6;
          if (age < 0 || age > 60) return null;
          const p = new THREE.Vector3(Math.cos(b.a) * b.v * age, 2.1 + b.up * age - 0.0045 * age * age, Math.sin(b.a) * b.v * age);
          if (p.y < 0) return null;
          return (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.07, 10, 10]} />
              <meshBasicMaterial color="#FFB347" toneMapped={false} />
            </mesh>
          );
        })}
      {f >= erupt - 20 &&
        smoke.map((s, i) => {
          const age = Math.max(0, f - (erupt - 20) - s.d);
          const k = age / 90;
          if (k <= 0) return null;
          return (
            <mesh key={i} position={[s.x + k * 1.2, 2.4 + k * 3.2, s.z]} scale={s.s * (0.25 + k * 0.8)}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshStandardMaterial color="#B5B8BE" roughness={1} transparent opacity={Math.max(0, 0.6 - k * 0.55)} depthWrite={false} />
            </mesh>
          );
        })}
    </group>
  );
};

// --- Tree --------------------------------------------------------------------------------------
/** A tree that grows from a sapling; on each cue a new crown of leaves fills out, then fruit appear. */
export const Tree: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame: f, fps, config: { damping: 18, mass: 2 } });
  const r = useMemo(() => rng(12), []);
  const blobs = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({ p: new THREE.Vector3((r() - 0.5) * 1.8, 2.3 + r() * 1.2, (r() - 0.5) * 1.6), s: 0.55 + r() * 0.35, k: i })),
    [r],
  );
  const fruit = useMemo(() => Array.from({ length: 8 }, () => new THREE.Vector3((r() - 0.5) * 2, 2.2 + r() * 1.3, 0.6 + r() * 0.5)), [r]);
  const steps = Math.max(1, cues.length);
  const fruitAt = cues.length > 1 ? cues[cues.length - 1] : Infinity;
  return (
    <group position={[0, -2.1, 0]} rotation={[0, f * 0.008, 0]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.6, 48]} />
        <meshStandardMaterial color="#8A6E52" roughness={1} />
      </mesh>
      <mesh position={[0, 1.15 * grow, 0]} scale={[1, grow, 1]} castShadow>
        <cylinderGeometry args={[0.16, 0.3, 2.3, 16]} />
        <meshStandardMaterial color="#7A5A3E" roughness={0.9} />
      </mesh>
      {blobs.map((b) => {
        const group = Math.floor((b.k / blobs.length) * steps);
        const at = group === 0 ? 20 : cues[group] ?? 20;
        const p = spring({ frame: f - at - (b.k % 3) * 3, fps, config: { damping: 12 } });
        if (p <= 0.01) return null;
        return (
          <mesh key={b.k} position={b.p.clone().multiplyScalar(grow)} scale={b.s * p} castShadow>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={b.k % 2 ? "#5DAA5A" : "#4C9A4E"} roughness={0.7} flatShading />
          </mesh>
        );
      })}
      {f >= fruitAt &&
        fruit.map((p, i) => {
          const s = spring({ frame: f - fruitAt - i * 2, fps, config: { damping: 10 } });
          return (
            <mesh key={i} position={p} scale={s * 0.16}>
              <sphereGeometry args={[1, 20, 20]} />
              <meshPhysicalMaterial {...gloss("#E2454F")} />
            </mesh>
          );
        })}
    </group>
  );
};

// --- Lock --------------------------------------------------------------------------------------
/** A padlock: a shield ring forms round it on the first cue; on the last it clicks open (or stays locked for one cue). */
export const Lock: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const body = useMemo(() => roundedRect(2.0, 1.7, 0.3), []);
  const shackle = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.62, Math.sin(a) * 0.75 + 0.55, 0));
    }
    pts.unshift(new THREE.Vector3(0.62, 0, 0));
    pts.push(new THREE.Vector3(-0.62, 0, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.14, 20, false);
  }, []);
  const keyhole = useMemo(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0.12, 0.16, 0, Math.PI * 2, false);
    const t = new THREE.Shape();
    t.moveTo(-0.07, 0.05);
    t.lineTo(0.07, 0.05);
    t.lineTo(0.11, -0.35);
    t.lineTo(-0.11, -0.35);
    return [s, t];
  }, []);
  const shield = useArrive(cueAt(cues, 0, 20), 26);
  const openAt = cues.length > 1 ? cues[cues.length - 1] : Infinity;
  const open = f >= openAt ? spring({ frame: f - openAt, fps, config: { damping: 9 } }) : 0;
  return (
    <group rotation={[0.08, Math.sin(f / 70) * 0.45, 0]} position={[0, -0.5, 0]}>
      {/* the shackle lifts and swings open round its left leg */}
      <group position={[-0.62, 0.55 + open * 0.5, 0]} rotation={[0, open * 1.3, 0]}>
        <mesh geometry={shackle} position={[0.62, 0, 0]} castShadow>
          <meshStandardMaterial color="#D5DAE0" metalness={1} roughness={0.16} />
        </mesh>
      </group>
      <mesh position={[0, 0, -0.35]} castShadow>
        <extrudeGeometry args={[body, { depth: 0.7, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 6, curveSegments: 20 }]} />
        <meshPhysicalMaterial {...gloss("#E7B53C", { metalness: 0.9, roughness: 0.25 })} />
      </mesh>
      {keyhole.map((s, i) => (
        <mesh key={i} position={[0, 0, 0.44]}>
          <shapeGeometry args={[s, 24]} />
          <meshBasicMaterial color="#2A2D33" />
        </mesh>
      ))}
      {shield > 0 && (
        <mesh rotation={[0, 0, f * 0.01]} scale={1.6 + shield * 0.4}>
          <torusGeometry args={[1.3, 0.03, 12, 120]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.7 * shield} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
};

// --- Hourglass ---------------------------------------------------------------------------------
const bulbGlass = (() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const y = -1.5 + t * 3;
    const w = 0.12 + 0.88 * Math.pow(Math.abs(y) / 1.5, 0.8);
    pts.push(new THREE.Vector2(Math.min(1, w), y));
  }
  return pts;
})();

/** An hourglass: sand runs from the top bulb to the bottom; on a middle cue it flips and starts over. */
export const Hourglass: React.FC<ModelProps> = ({ cues, frames }) => {
  const f = useCurrentFrame();
  const flipAt = cues.length > 2 ? cues[1] : Infinity;
  // With fewer than 3 items it never flips (and interpolate needs finite keyframes).
  const flip = Number.isFinite(flipAt) ? interpolate(f, [flipAt, flipAt + 24], [0, 1], { ...clamp, easing: (t) => t * t * (3 - 2 * t) }) : 0;
  const runStart = f < flipAt + 24 ? 0 : flipAt + 24;
  const runEnd = f < flipAt + 24 ? Math.min(flipAt, frames) : frames;
  const k = interpolate(f, [runStart, Math.max(runStart + 30, runEnd)], [0.05, 0.92], clamp);
  return (
    <group rotation={[0.1, Math.sin(f / 90) * 0.4, flip * Math.PI]} position={[0, 0.1, 0]}>
      <mesh>
        <latheGeometry args={[bulbGlass, 64]} />
        <meshPhysicalMaterial color="#FFFFFF" transparent opacity={0.25} roughness={0.04} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* sand: a shrinking cone on top, a growing pile below, and the falling thread between */}
      <mesh position={[0, 0.15 + (1 - k) * 0.6, 0]} rotation={[Math.PI, 0, 0]} scale={[Math.max(0.05, 1 - k), Math.max(0.05, 1 - k), Math.max(0.05, 1 - k)]}>
        <coneGeometry args={[0.85, 1.25, 40]} />
        <meshStandardMaterial color="#E3BD72" roughness={0.9} />
      </mesh>
      <mesh position={[0, -1.48 + k * 0.55, 0]} scale={[Math.max(0.1, k), Math.max(0.05, k), Math.max(0.1, k)]}>
        <coneGeometry args={[0.95, 1.1, 40]} />
        <meshStandardMaterial color="#E3BD72" roughness={0.9} />
      </mesh>
      {k < 0.9 && (flip === 0 || flip === 1) ? (
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.6, 8]} />
          <meshStandardMaterial color="#E3BD72" roughness={0.9} />
        </mesh>
      ) : null}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * 1.62, 0]} castShadow>
          <cylinderGeometry args={[1.25, 1.25, 0.24, 48]} />
          <meshStandardMaterial color="#8A5A36" roughness={0.6} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.08, 0, Math.sin(a) * 1.08]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 3.1, 12]} />
            <meshStandardMaterial color="#8A5A36" roughness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
};
