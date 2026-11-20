import React from "react";
import * as THREE from "three";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, PALE, Studio } from "./studio";

const BOND = 1.9;
// Directions for 1 to 4 atoms: a line, a bent pair, a triangle, a tetrahedron.
const DIRS: [number, number, number][][] = [
  [[1, 0, 0]],
  [
    [-0.79, -0.61, 0],
    [0.79, -0.61, 0],
  ],
  [
    [0, 1, 0],
    [0.87, -0.5, 0],
    [-0.87, -0.5, 0],
  ],
  [
    [0, 1, 0],
    [0.94, -0.33, 0],
    [-0.47, -0.33, 0.82],
    [-0.47, -0.33, -0.82],
  ],
];
const COLORS = [PALE, "#9CC2F2", "#F2B8A0", "#E8C547"];

/** Atoms fly in and bond to a central atom, one on each cue, while the molecule turns. */
export const Molecule: React.FC<{ cues: number[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dirs = DIRS[Math.min(4, cues.length) - 1];
  const core = spring({ frame, fps, config: { damping: 12 } });
  const camera = () => ({ pos: [0, 1.4, 7.4] as [number, number, number], look: [0, 0.2, 0] as [number, number, number] });
  return (
    <Studio camera={camera} floorY={-2.8}>
      <group rotation={[0.2 + Math.sin(frame / 90) * 0.15, Math.sin(frame / 70) * 0.7, 0]} position={[0, 0.3, 0]}>
        <mesh scale={0.3 + 0.7 * core} castShadow>
          <sphereGeometry args={[0.75, 48, 48]} />
          <meshStandardMaterial color={ACCENT} roughness={0.3} metalness={0.1} />
        </mesh>
        {dirs.map((d, i) => {
          if (frame < cues[i] - 10) return null;
          const p = spring({ frame: frame - cues[i] + 10, fps, config: { damping: 13, mass: 0.6 } });
          const dist = BOND + (1 - p) * 5;
          const pos = new THREE.Vector3(...d).normalize().multiplyScalar(dist);
          const bond = interpolate(frame, [cues[i], cues[i] + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d).normalize());
          return (
            <group key={i}>
              {bond > 0 && (
                <mesh quaternion={q} position={new THREE.Vector3(...d).normalize().multiplyScalar((BOND / 2) * bond)}>
                  <cylinderGeometry args={[0.11, 0.11, BOND * bond, 16]} />
                  <meshStandardMaterial color="#C9C2B6" roughness={0.5} />
                </mesh>
              )}
              <mesh position={pos} castShadow>
                <sphereGeometry args={[0.48, 40, 40]} />
                <meshStandardMaterial color={COLORS[i % COLORS.length]} roughness={0.28} />
              </mesh>
            </group>
          );
        })}
      </group>
    </Studio>
  );
};
