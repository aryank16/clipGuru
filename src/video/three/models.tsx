import React, { useMemo } from "react";
import * as THREE from "three";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Cinema, Glow, useArrive, type Shot } from "./cinema";
import { rng } from "./studio";
import { Highway } from "./Highway";
import { Battery, Brain, Hourglass, Lock, Magnet, Phone, Tree, Volcano } from "./models-more";

/**
 * The 3D model library: hand-built, fully animated objects the storyboard writer can pick by
 * name. They are made in code (no downloaded files), so they load instantly, look the same on
 * every render and carry no licence terms. Each one reacts to the scene's cue words.
 */
export type ModelProps = { cues: number[]; frames: number };

const ACCENT = theme.accent;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const gloss = (color: string, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => ({
  color,
  roughness: 0.28,
  metalness: 0,
  clearcoat: 0.8,
  clearcoatRoughness: 0.15,
  ...extra,
});

// --- DNA ---------------------------------------------------------------------------------------
const BASES = ["#F2A65A", "#5FBF9A", "#E86A6A", "#F4D35E"];

/** A double helix that builds from the bottom up, then each cue lights up a stretch of it. */
export const Dna: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const N = 26;
  const H = 5.6;
  const R = 0.95;
  const grow = interpolate(f, [0, Math.max(30, cues[0] ?? 30)], [0, 1], clamp);
  const strands = useMemo(
    () =>
      [0, Math.PI].map((ph) => {
        const pts = Array.from({ length: 200 }, (_, i) => {
          const t = i / 199;
          const a = t * Math.PI * 4 + ph;
          return new THREE.Vector3(Math.cos(a) * R, t * H - H / 2, Math.sin(a) * R);
        });
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.13, 16, false);
      }),
    [],
  );
  const shown = Math.round(grow * strands[0].index!.count);
  const lit = cues.filter((c) => f >= c).length;
  return (
    <group rotation={[0.18, f * 0.012, -0.18]}>
      {strands.map((g, i) => (
        // Draw only the grown part of each strand.
        <mesh key={i} geometry={(g.setDrawRange(0, shown), g)} castShadow>
          <meshPhysicalMaterial {...gloss(i ? "#DCE7F7" : ACCENT)} />
        </mesh>
      ))}
      {Array.from({ length: N }, (_, i) => {
        const t = (i + 0.5) / N;
        if (t > grow) return null;
        const a = t * Math.PI * 4;
        const y = t * H - H / 2;
        const seg = Math.floor((i / N) * Math.max(1, cues.length));
        const on = seg < lit;
        const pulse = on ? 1 + 0.25 * Math.max(0, 1 - (f - cues[seg]) / 14) : 1;
        const col = BASES[i % 4];
        return (
          <group key={i} position={[0, y, 0]} rotation={[0, -a, 0]} scale={[1, pulse, pulse]}>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[(s * R) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.07, 0.07, R * 0.92, 12]} />
                <meshPhysicalMaterial
                  {...gloss(s < 0 ? col : BASES[(i + 2) % 4])}
                  emissive={on ? (s < 0 ? col : BASES[(i + 2) % 4]) : "#000000"}
                  emissiveIntensity={on ? 0.9 : 0}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

// --- Cell --------------------------------------------------------------------------------------
/** A see-through cell: the glass membrane, then the nucleus and organelles arrive on each cue. */
export const Cell: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const r = useMemo(() => rng(7), []);
  const mito = useMemo(() => Array.from({ length: 5 }, () => [r() * 6.28, r() * 1.2 - 0.6, 1.15 + r() * 0.35, r() * 6.28] as const), [r]);
  const ribo = useMemo(() => Array.from({ length: 40 }, () => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.9 + r() * 0.75)), [r]);
  const at = (i: number) => cues[Math.min(i, cues.length - 1)] ?? 20;
  const nucleus = useArrive(at(0));
  const mitoP = useArrive(at(1));
  const riboP = useArrive(at(2));
  const membrane = useArrive(0, 24);
  return (
    <group rotation={[0.25, f * 0.008, 0]}>
      <mesh scale={membrane * 2.15} castShadow>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhysicalMaterial color="#D8E8FA" transmission={1} thickness={1.2} roughness={0.12} ior={1.33} clearcoat={1} attenuationColor="#BBD4F5" attenuationDistance={3} />
      </mesh>
      <group scale={nucleus}>
        <mesh position={[0.15, 0.1, 0]}>
          <sphereGeometry args={[0.72, 64, 64]} />
          <meshPhysicalMaterial {...gloss("#7B61C9")} sheen={1} sheenColor="#C9B8FF" />
        </mesh>
        <mesh position={[0.38, 0.32, 0.45]}>
          <sphereGeometry args={[0.22, 32, 32]} />
          <meshPhysicalMaterial {...gloss("#4B3A99")} />
        </mesh>
      </group>
      {mito.map(([a, y, d, rot], i) => (
        <mesh key={i} position={[Math.cos(a) * d, y, Math.sin(a) * d]} rotation={[rot, a, 0.6]} scale={mitoP}>
          <capsuleGeometry args={[0.13, 0.42, 8, 20]} />
          <meshPhysicalMaterial {...gloss("#F08A4B")} emissive="#F08A4B" emissiveIntensity={0.15} />
        </mesh>
      ))}
      {ribo.map((p, i) => (
        <mesh key={i} position={p} scale={riboP * (0.6 + (i % 3) * 0.2)}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#2F7DE1" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
};

// --- Rocket ------------------------------------------------------------------------------------
const bodyProfile = (() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const y = t * 3.6;
    // Straight body, then an ogive nose cone.
    const rad = t < 0.62 ? 0.52 : 0.52 * Math.cos(((t - 0.62) / 0.38) * (Math.PI / 2)) ** 0.8;
    pts.push(new THREE.Vector2(Math.max(0.001, rad), y));
  }
  return pts;
})();

const finShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.62, -0.3);
  s.lineTo(0.62, 0.05);
  s.lineTo(0, 1.0);
  s.lineTo(0, 0);
  return s;
})();

/** A rocket on the pad: its engines light on the first cue and it lifts off on the last. */
export const Rocket: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ignite = cues[0] ?? 20;
  const lift = cues[cues.length - 1] ?? 60;
  const burn = interpolate(f, [ignite, ignite + 10], [0, 1], clamp);
  const t = Math.max(0, f - lift) / fps;
  const y = 0.5 * 2.2 * t * t; // constant acceleration
  const shake = burn > 0 && t === 0 ? Math.sin(f * 2.3) * 0.015 : 0;
  const r = useMemo(() => rng(3), []);
  const puffs = useMemo(() => Array.from({ length: 22 }, () => [r() * 6.28, r(), r()] as const), [r]);
  return (
    <group position={[shake, -1.9 + y, 0]} rotation={[0, f * 0.006, 0]}>
      <mesh castShadow>
        <latheGeometry args={[bodyProfile, 64]} />
        <meshPhysicalMaterial {...gloss("#FBFAF7")} />
      </mesh>
      <mesh position={[0, 2.86, 0]}>
        <cylinderGeometry args={[0.425, 0.47, 0.18, 64]} />
        <meshPhysicalMaterial {...gloss(ACCENT)} />
      </mesh>
      {/* porthole */}
      <mesh position={[0, 1.75, 0.5]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.17, 0.045, 16, 48]} />
        <meshStandardMaterial color="#B9C0C9" metalness={1} roughness={0.25} />
      </mesh>
      <mesh position={[0, 1.75, 0.47]} scale={[1, 1, 0.4]}>
        <sphereGeometry args={[0.15, 32, 32]} />
        <meshPhysicalMaterial color="#8FB9EE" roughness={0.05} clearcoat={1} metalness={0.2} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]} castShadow>
          <mesh position={[0.48, 0.25, -0.04]}>
            <extrudeGeometry args={[finShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 }]} />
            <meshPhysicalMaterial {...gloss(ACCENT)} />
          </mesh>
        </mesh>
      ))}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 0.26, 48, 1, true]} />
        <meshStandardMaterial color="#6E7580" metalness={1} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* flame: a bright core inside a softer outer glow; bloom makes it shine */}
      {burn > 0 && (
        <group position={[0, -0.25, 0]} scale={[1, burn * (1 + Math.sin(f * 1.7) * 0.08 + Math.min(1.2, t)), 1]}>
          <mesh position={[0, -0.55, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.3, 1.1, 32, 1, true]} />
            <meshBasicMaterial color="#FFB347" transparent opacity={0.75} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.4, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.16, 0.75, 24]} />
            <meshBasicMaterial color="#FFF4D6" toneMapped={false} />
          </mesh>
          <Glow color="#FFB347" size={1.6} opacity={0.55} position={[0, -0.5, 0.2]} />
        </group>
      )}
      {/* exhaust clouds roll out across the pad */}
      {burn > 0 &&
        puffs.map(([a, s, d], i) => {
          const age = Math.max(0, f - ignite - d * 18) / 40;
          const rad = Math.min(2.6, age * (1.2 + s));
          return (
            <mesh key={i} position={[Math.cos(a) * rad, -y - 0.35 + age * 0.15, Math.sin(a) * rad]} scale={Math.min(0.55, 0.12 + age * 0.35) * (0.7 + s * 0.6)}>
              <sphereGeometry args={[1, 20, 20]} />
              <meshStandardMaterial color="#FFFFFF" roughness={1} transparent opacity={Math.max(0, 0.95 - age * 0.25)} />
            </mesh>
          );
        })}
    </group>
  );
};

// --- Light bulb --------------------------------------------------------------------------------
const bulbProfile = (() => {
  // A round glass globe that narrows into a neck, from the top (y = 1.05) down to the base.
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 0.78; // from the top of the sphere round to below its middle
    pts.push(new THREE.Vector2(Math.max(0.001, Math.sin(a) * 1.05), Math.cos(a) * 1.05));
  }
  const last = pts[pts.length - 1];
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    const ease = t * t * (3 - 2 * t);
    pts.push(new THREE.Vector2(last.x + (0.4 - last.x) * ease, last.y - t * 0.55));
  }
  pts.push(new THREE.Vector2(0.4, -1.3));
  return pts.reverse();
})();

/** A glass light bulb that flickers on at the first cue and glows brighter with each one after. */
export const Bulb: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const on = cues.filter((c) => f >= c).length;
  const first = cues[0] ?? 20;
  const flick = f < first ? 0 : f < first + 8 ? (Math.floor(f) % 2 ? 0.3 : 1) : 1;
  const glow = flick * (0.5 + (0.5 * on) / Math.max(1, cues.length));
  const coil = useMemo(() => {
    const pts = Array.from({ length: 120 }, (_, i) => {
      const t = i / 119;
      const a = t * Math.PI * 10;
      return new THREE.Vector3(-0.32 + t * 0.64, 0.18 + Math.sin(a) * 0.05, Math.cos(a) * 0.05);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.012, 8, false);
  }, []);
  return (
    <group position={[0, 0.25, 0]} rotation={[0.08, Math.sin(f / 60) * 0.5, 0.06]}>
      <mesh>
        <latheGeometry args={[bulbProfile, 80]} />
        <meshPhysicalMaterial color="#FFFFFF" transmission={1} thickness={0.15} roughness={0.04} ior={1.5} clearcoat={1} emissive="#FFD27A" emissiveIntensity={glow * 0.35} />
      </mesh>
      <mesh geometry={coil}>
        <meshBasicMaterial color={glow > 0 ? "#FFF1C2" : "#6E6355"} toneMapped={false} />
      </mesh>
      {glow > 0 && <Glow color="#FFC95E" size={1.2 + glow * 1.6} opacity={0.35 + glow * 0.4} position={[0, 0.18, 0]} />}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.32, -0.45, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 1.25, 8]} />
          <meshStandardMaterial color="#9A9184" metalness={1} roughness={0.3} />
        </mesh>
      ))}
      {/* screw base: stacked metal rings */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, -1.32 - i * 0.14, 0]} castShadow>
          <torusGeometry args={[0.4 - i * 0.012, 0.06, 16, 64]} />
          <meshStandardMaterial color="#C8CDD4" metalness={1} roughness={0.22} />
        </mesh>
      ))}
      <mesh position={[0, -1.7, 0]} castShadow>
        <cylinderGeometry args={[0.37, 0.22, 0.4, 48]} />
        <meshStandardMaterial color="#C8CDD4" metalness={1} roughness={0.22} />
      </mesh>
      <mesh position={[0, -1.95, 0]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial color="#2A2D33" roughness={0.5} />
      </mesh>
      {glow > 0 && <pointLight position={[0, 0.2, 0]} intensity={glow * 12} distance={8} color="#FFC870" />}
    </group>
  );
};

// --- Gears -------------------------------------------------------------------------------------
function gearShape(teeth: number, r: number) {
  const s = new THREE.Shape();
  const inner = r - 0.18;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const w = (Math.PI * 2) / teeth;
    const p = (ang: number, rad: number) => [Math.cos(ang) * rad, Math.sin(ang) * rad] as const;
    const pts = [p(a, inner), p(a + w * 0.18, r), p(a + w * 0.5, r), p(a + w * 0.68, inner)];
    if (i === 0) s.moveTo(...pts[0]);
    for (const q of pts) s.lineTo(...q);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.22, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

const GEARS = [
  { teeth: 18, r: 1.25, x: -0.95, y: 0.15, color: ACCENT },
  { teeth: 12, r: 0.86, x: 1.06, y: 0.55, color: "#C8CDD4" },
  { teeth: 9, r: 0.66, x: 0.55, y: -1.3, color: "#E0B04A" },
];

/** Interlocking gears that join one per cue, each turning at the speed its teeth allow. */
export const Gears: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shapes = useMemo(() => GEARS.map((g) => gearShape(g.teeth, g.r)), []);
  const spin = f * 0.025;
  return (
    <group rotation={[-0.35, 0.45, 0]}>
      {GEARS.map((g, i) => {
        const at = cues[Math.min(i, cues.length - 1)] ?? i * 15;
        const p = spring({ frame: f - at + 8, fps, config: { damping: 14 } });
        const dir = i === 0 ? 1 : -1;
        const speed = (GEARS[0].teeth / g.teeth) * dir;
        const phase = i === 1 ? Math.PI / g.teeth : i === 2 ? 0.2 : 0;
        return (
          <group key={i} position={[g.x, g.y, (1 - p) * 4]} scale={p}>
            <mesh rotation={[0, 0, spin * speed + phase]} position={[0, 0, -0.15]} castShadow>
              <extrudeGeometry args={[shapes[i], { depth: 0.3, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 24 }]} />
              <meshPhysicalMaterial color={g.color} metalness={i === 0 ? 0.2 : 1} roughness={i === 0 ? 0.3 : 0.25} clearcoat={i === 0 ? 1 : 0} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[g.r * 0.24, g.r * 0.24, 0.5, 32]} />
              <meshStandardMaterial color="#2A2D33" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// --- Coins -------------------------------------------------------------------------------------
/** Gold coins rain into stacks, one stack per cue, each taller than the last. */
export const Coins: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const n = Math.max(1, Math.min(4, cues.length));
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 1.25);
  return (
    <group position={[0, -1.6, 0]} rotation={[0.1, -0.35, 0]}>
      {xs.map((x, s) => {
        const count = 3 + s * 3;
        return Array.from({ length: count }, (_, k) => {
          const at = (cues[s] ?? s * 20) + k * 2.2;
          const dropT = Math.max(0, f - at);
          const fall = Math.max(0, 6 - 0.5 * 0.06 * dropT * dropT * 3);
          const landed = fall === 0;
          const bounce = landed ? Math.max(0, Math.sin((dropT - Math.sqrt(6 / 0.09)) * 0.6) * 0.06 * Math.exp(-(dropT - 8) / 6)) : 0;
          if (f < at) return null;
          return (
            <mesh key={`${s}-${k}`} position={[x + Math.sin(k * 2.1) * 0.03, k * 0.17 + 0.085 + fall + bounce, Math.cos(k * 1.7) * 0.03]} rotation={[landed ? 0 : dropT * 0.3, k * 0.7, 0]} castShadow>
              <cylinderGeometry args={[0.48, 0.48, 0.15, 64]} />
              <meshStandardMaterial color="#E7B53C" metalness={1} roughness={0.22} />
            </mesh>
          );
        });
      })}
    </group>
  );
};

// --- Planet ------------------------------------------------------------------------------------
function bandTexture() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const cols = ["#E9C9A0", "#D9A877", "#F3DEC2", "#C98F5E", "#EED3AE", "#B87D4E", "#F1DCC0"];
  const r = rng(11);
  let y = 0;
  while (y < 256) {
    const h = 6 + r() * 26;
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.fillRect(0, y, 4, h);
    y += h;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ringTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 4;
  const g = c.getContext("2d")!;
  const r = rng(5);
  for (let x = 0; x < 256; x++) {
    const a = (0.35 + r() * 0.5) * (x > 40 && x < 52 ? 0.15 : 1);
    g.fillStyle = `rgba(196,160,118,${a})`;
    g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A ringed planet: the rings sweep open on the first cue and a moon swings past on the next. */
export const Planet: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const bands = useMemo(() => bandTexture(), []);
  const ringTex = useMemo(() => ringTexture(), []);
  const ringGeo = useMemo(() => {
    const g = new THREE.RingGeometry(1.9, 3.2, 128, 1);
    // Map the texture across the ring's width, not around it.
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (d - 1.9) / 1.3, 0.5);
    }
    return g;
  }, []);
  const ring = useArrive(cues[0] ?? 20, 30);
  const moonAt = cues[1] ?? 50;
  const ma = (f - moonAt) * 0.03;
  const moon = useArrive(moonAt - 20, 20);
  return (
    <group rotation={[0.5, 0, -0.32]} position={[0, 0.1, 0]}>
      <mesh rotation={[0, f * 0.01, 0]} castShadow>
        <sphereGeometry args={[1.45, 128, 128]} />
        <meshPhysicalMaterial map={bands} roughness={0.6} clearcoat={0.3} />
      </mesh>
      <mesh geometry={ringGeo} rotation={[-Math.PI / 2, 0, f * 0.003]} scale={0.6 + 0.4 * ring}>
        <meshStandardMaterial map={ringTex} transparent opacity={ring} side={THREE.DoubleSide} roughness={1} envMapIntensity={0.4} depthWrite={false} />
      </mesh>
      {f >= moonAt - 20 && (
        <mesh position={[Math.cos(ma) * 3.6, Math.sin(ma) * 0.6, Math.sin(ma) * 3.6]} scale={moon} castShadow>
          <sphereGeometry args={[0.32, 48, 48]} />
          <meshStandardMaterial color="#D8D4CC" roughness={0.9} />
        </mesh>
      )}
    </group>
  );
};

// --- Heart -------------------------------------------------------------------------------------
const heartShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -1.1);
  s.bezierCurveTo(-0.3, -0.75, -1.25, -0.35, -1.25, 0.35);
  s.bezierCurveTo(-1.25, 0.95, -0.7, 1.2, -0.38, 1.2);
  s.bezierCurveTo(-0.12, 1.2, 0, 1.0, 0, 0.82);
  s.bezierCurveTo(0, 1.0, 0.12, 1.2, 0.38, 1.2);
  s.bezierCurveTo(0.7, 1.2, 1.25, 0.95, 1.25, 0.35);
  s.bezierCurveTo(1.25, -0.35, 0.3, -0.75, 0, -1.1);
  return s;
})();

/** A glossy heart that beats in time, harder on each cue, with a pulse ring going out. */
export const Heart: React.FC<ModelProps> = ({ cues }) => {
  const f = useCurrentFrame();
  const beat = (x: number) => Math.exp(-((x % 26) ** 2) / 8) + 0.5 * Math.exp(-(((x % 26) - 7) ** 2) / 6);
  const hard = cues.filter((c) => f >= c).length / Math.max(1, cues.length);
  const s = 1 + beat(f) * (0.05 + 0.07 * hard);
  const last = [...cues].reverse().find((c) => f >= c);
  const ringP = last === undefined ? -1 : (f - last) / 30;
  return (
    <group rotation={[0.12, Math.sin(f / 50) * 0.35, 0]}>
      <mesh scale={s} position={[0, 0.05, -0.35]} castShadow>
        <extrudeGeometry args={[heartShape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.32, bevelThickness: 0.36, bevelSegments: 16, curveSegments: 48 }]} />
        <meshPhysicalMaterial {...gloss("#C8202E", { roughness: 0.35, envMapIntensity: 0.6 })} sheen={0.4} sheenColor="#FF7A85" />
      </mesh>
      {ringP >= 0 && ringP < 1 && (
        <mesh scale={1.6 + ringP * 2.4}>
          <torusGeometry args={[1, 0.02, 12, 96]} />
          <meshBasicMaterial color="#E2454F" transparent opacity={(1 - ringP) * 0.6} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
};

// --- Library -----------------------------------------------------------------------------------
type Entry = { Model: React.FC<ModelProps>; shot: Shot; label: string; floorY?: number };
export const MODELS = {
  dna: { Model: Dna, label: "DNA", shot: { from: [0, 0.8, 14], to: [0, 0.3, 11], orbit: 30 }, floorY: -3.4 },
  cell: { Model: Cell, label: "Cell", shot: { from: [0, 1.4, 13], to: [0, 0.8, 10], orbit: 40 }, floorY: -2.5 },
  rocket: { Model: Rocket, label: "Rocket", shot: { from: [2.4, -0.2, 12], to: [1.5, 0.5, 10.6], look: [0, 0.35, 0], orbit: 18 }, floorY: -2.25 },
  bulb: { Model: Bulb, label: "Light bulb", shot: { from: [0, 0.4, 10.5], to: [0, 0.1, 8.6], look: [0, -0.15, 0], orbit: 26 }, floorY: -2.2 },
  gears: { Model: Gears, label: "Gears", shot: { from: [0, 0.4, 11], to: [0, 0.1, 8.8], orbit: 22 }, floorY: -2.4 },
  coins: { Model: Coins, label: "Coins", shot: { from: [0, 2.4, 10], to: [0, 1.4, 7.8], look: [0, -0.5, 0], orbit: 30 }, floorY: -1.6 },
  planet: { Model: Planet, label: "Planet", shot: { from: [0, 1.8, 13], to: [0, 1.2, 10.5], orbit: 34 }, floorY: -4 },
  heart: { Model: Heart, label: "Heart", shot: { from: [0, 0.4, 10.5], to: [0, 0.2, 8.8], orbit: 24 }, floorY: -2.3 },
  brain: { Model: Brain, label: "Brain", shot: { from: [0, 1.6, 11], to: [0, 1.0, 8.6], look: [0, 0.2, 0], orbit: 30 }, floorY: -1.8 },
  battery: { Model: Battery, label: "Battery", shot: { from: [0, 0.8, 11], to: [0, 0.4, 8.8], orbit: 24 }, floorY: -1.75 },
  phone: { Model: Phone, label: "Phone", shot: { from: [0, 0.3, 11.5], to: [0, 0.2, 9.4], orbit: 18 }, floorY: -2.4 },
  magnet: { Model: Magnet, label: "Magnet", shot: { from: [0, 0.8, 12], to: [0, 0.6, 9.6], look: [0, 0.2, 0], orbit: 26 }, floorY: -2.3 },
  volcano: { Model: Volcano, label: "Volcano", shot: { from: [0, 2.0, 13], to: [0, 1.4, 10.4], look: [0, 0.3, 0], orbit: 30 }, floorY: -1.7 },
  tree: { Model: Tree, label: "Tree", shot: { from: [0, 1.2, 12], to: [0, 0.9, 9.6], look: [0, 0.3, 0], orbit: 30 }, floorY: -2.1 },
  lock: { Model: Lock, label: "Lock", shot: { from: [0, 0.6, 10.5], to: [0, 0.4, 8.4], look: [0, 0.1, 0], orbit: 24 }, floorY: -1.5 },
  hourglass: { Model: Hourglass, label: "Hourglass", shot: { from: [0, 0.6, 11], to: [0, 0.3, 8.8], orbit: 22 }, floorY: -1.76 },
  // Films its own camera (it follows the bullet); the shot here is only a fallback.
  highway: { Model: Highway, label: "Bullet vs car", shot: { from: [2.2, 1.25, 8.2], to: [2.2, 1.25, 8.2], look: [0, 0.75, 0], orbit: 0 }, floorY: -0.01 },
} satisfies Record<string, Entry>;
export type ModelId = keyof typeof MODELS;

/** One library model on the cinematic stage. */
export const ModelShot: React.FC<{ model: ModelId; cues: number[]; frames: number }> = ({ model, cues, frames }) => {
  const e: Entry = MODELS[model];
  return (
    <Cinema shot={e.shot} frames={frames} floorY={e.floorY}>
      <e.Model cues={cues} frames={frames} />
    </Cinema>
  );
};
