import React from "react";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

/** Where the 3D view sits on the 1080 x 1920 frame: between the heading and the item chips. */
export const VIEW = { top: 430, height: 820 };

/** Seeded random numbers, so every render of a frame is identical. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export type Vec3 = [number, number, number];

/** Keeps the camera on a path given as a function of the scene's frame. */
const CameraRig: React.FC<{ at: (frame: number) => { pos: Vec3; look: Vec3 } }> = ({ at }) => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera);
  const { pos, look } = at(frame);
  camera.position.set(...pos);
  camera.lookAt(...look);
  return null;
};

/**
 * A soft studio for every 3D shot: a see-through canvas (the page background shows through),
 * a key light with soft shadows, and an invisible floor that only catches shadows.
 */
export const Studio: React.FC<{
  camera: (frame: number) => { pos: Vec3; look: Vec3 };
  floorY?: number;
  fov?: number;
  children: React.ReactNode;
}> = ({ camera, floorY = 0, fov = 32, children }) => {
  const { width } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: VIEW.top,
        width,
        height: VIEW.height,
        // Fade the top and bottom edges into the page.
        maskImage: "linear-gradient(to bottom, transparent 0, #000 9%, #000 88%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 9%, #000 88%, transparent 100%)",
      }}
    >
      <ThreeCanvas width={width} height={VIEW.height} shadows camera={{ fov, near: 0.1, far: 120 }}>
        <CameraRig at={camera} />
        <hemisphereLight args={["#ffffff", "#c9c2b6", 1.1]} />
        <directionalLight position={[4, 10, 6]} intensity={2.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0004}>
          <orthographicCamera attach="shadow-camera" args={[-9, 9, 9, -9, 0.5, 40]} />
        </directionalLight>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
          <planeGeometry args={[120, 120]} />
          <shadowMaterial transparent opacity={0.16} />
        </mesh>
        {children}
      </ThreeCanvas>
    </div>
  );
};

export const ACCENT = theme.accent;
export const PALE = "#F8F7F3";
export const SKY = "#CFE0F8";
