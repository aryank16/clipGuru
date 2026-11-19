import React, { useMemo } from "react";
import * as THREE from "three";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, Studio } from "./studio";

const R = 2.1;
// Spread across the side of the globe that faces the camera (lat, lon in degrees).
const SPOTS: [number, number][] = [
  [42, -20],
  [12, 28],
  [-18, -8],
  [30, 55],
];

const toVec = (lat: number, lon: number, r = R) => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const th = ((lon + 90) * Math.PI) / 180;
  return new THREE.Vector3(r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

/** A turning Earth: place i is marked on cue i, and an arc links it to the one before. */
export const Globe: React.FC<{ cues: number[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spin = -0.35 + frame / 600;
  const pins = cues.map((_, i) => toVec(...SPOTS[i % SPOTS.length]));
  const arcs = useMemo(
    () =>
      pins.slice(1).map((b, i) => {
        const a = pins[i];
        const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.45);
        return new THREE.QuadraticBezierCurve3(a, mid, b);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pins depend only on the count
    [cues.length],
  );
  const camera = () => ({ pos: [0, 1.2, 8] as [number, number, number], look: [0, 0.1, 0] as [number, number, number] });
  const grow = spring({ frame, fps, config: { damping: 14 } });
  return (
    <Studio camera={camera} floorY={-2.9}>
      <group rotation={[0.25, spin, 0]} scale={0.6 + 0.4 * grow}>
        <mesh castShadow>
          <sphereGeometry args={[R, 64, 64]} />
          <meshStandardMaterial color="#DCE8F7" roughness={0.55} />
        </mesh>
        <mesh>
          <sphereGeometry args={[R * 1.003, 24, 16]} />
          <meshBasicMaterial color={ACCENT} wireframe transparent opacity={0.22} />
        </mesh>
        {pins.map((v, i) => {
          const p = spring({ frame: frame - cues[i], fps, config: { damping: 10, mass: 0.6 } });
          if (frame < cues[i]) return null;
          const n = v.clone().normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
          const ring = ((frame - cues[i]) % 45) / 45;
          return (
            <group key={i} position={v} quaternion={q}>
              <mesh position={[0, 0.28 * p, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.56 * p, 8]} />
                <meshStandardMaterial color="#1F2328" />
              </mesh>
              <mesh position={[0, 0.6 * p, 0]} scale={Math.max(0.001, p)} castShadow>
                <sphereGeometry args={[0.13, 24, 24]} />
                <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.4} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} scale={0.2 + ring * 0.9}>
                <torusGeometry args={[0.4, 0.02, 8, 48]} />
                <meshBasicMaterial color={ACCENT} transparent opacity={(1 - ring) * 0.8} />
              </mesh>
            </group>
          );
        })}
        {arcs.map((c, i) => {
          const t = interpolate(frame, [cues[i + 1] - 4, cues[i + 1] + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (t <= 0.02) return null;
          const pts = c.getPoints(40).slice(0, Math.max(2, Math.round(41 * t)));
          return (
            <mesh key={i}>
              <tubeGeometry args={[new THREE.CatmullRomCurve3(pts), 48, 0.035, 8, false]} />
              <meshBasicMaterial color={ACCENT} />
            </mesh>
          );
        })}
      </group>
    </Studio>
  );
};
