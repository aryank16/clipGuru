import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ThreeCanvas } from "@remotion/three";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { VIEW, type Vec3 } from "./studio";

const EDGE_FADE =
  "linear-gradient(to bottom, transparent 0, #000 10%, #000 86%, transparent 100%), linear-gradient(to right, transparent 0, #000 7%, #000 93%, transparent 100%)";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Lights the scene's shiny materials with the given reflections. */
function applyEnvironment(scene: THREE.Scene, env: THREE.Texture) {
  scene.environment = env;
  scene.environmentIntensity = 0.85;
}

/** Soft studio reflections for shiny materials (glass, metal, gloss paint), built in code: no image to load. */
const Environment: React.FC = () => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    applyEnvironment(scene, env);
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
};

/**
 * The paper backdrop: a curved studio sweep in the page colour, a little warmer at the floor,
 * so the 3D view melts into the page around it.
 */
const Backdrop: React.FC = () => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, theme.bg);
    grad.addColorStop(0.62, theme.bg);
    grad.addColorStop(1, "#ECE7DD");
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 6, -14]}>
      <planeGeometry args={[90, 40]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

export type Shot = {
  /** Camera start and end positions; it glides between them over the scene. */
  from: Vec3;
  to: Vec3;
  look?: Vec3;
  /** Degrees the camera swings round the subject over the scene. */
  orbit?: number;
};

const CameraRig: React.FC<{ shot: Shot; frames: number }> = ({ shot, frames }) => {
  const f = useCurrentFrame();
  const camera = useThree((s) => s.camera);
  const k = interpolate(f, [0, frames], [0, 1], { ...clamp, easing: Easing.bezier(0.33, 0, 0.2, 1) });
  const p = new THREE.Vector3(...shot.from).lerp(new THREE.Vector3(...shot.to), k);
  // Swing round the vertical axis, plus a tiny handheld drift so the shot never feels frozen.
  p.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad((shot.orbit ?? 24) * (k - 0.5)));
  p.x += Math.sin(f / 37) * 0.03;
  p.y += Math.cos(f / 43) * 0.025;
  camera.position.copy(p);
  camera.lookAt(...(shot.look ?? [0, 0, 0]));
  return null;
};

/**
 * A cinematic studio for a 3D subject: studio reflections, a key light with soft shadows and a cool
 * rim light, and a moving camera. No post-processing passes: on the render servers' software GL they
 * made each frame about 4x slower, so glows are drawn as soft halo sprites instead (see Glow).
 */
export const Cinema: React.FC<{
  shot: Shot;
  /** How long the scene is, for the camera move. */
  frames: number;
  floorY?: number;
  fov?: number;
  children: React.ReactNode;
}> = ({ shot, frames, floorY = -2.2, fov = 30, children }) => {
  const { width } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: VIEW.top,
        width,
        height: VIEW.height,
        // Fade every edge into the page, so the 3D view has no visible box even while the stage turns.
        maskImage: EDGE_FADE,
        WebkitMaskImage: EDGE_FADE,
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
      }}
    >
      <ThreeCanvas
        width={width}
        height={VIEW.height}
        shadows
        camera={{ fov, near: 0.1, far: 120 }}
        gl={{ antialias: true }}
        flat={false}
      >
        <color attach="background" args={[theme.bg]} />
        <CameraRig shot={shot} frames={frames} />
        <Environment />
        <Backdrop />
        <hemisphereLight args={["#ffffff", "#d8d0c2", 0.55]} />
        <directionalLight
          position={[4.5, 9, 6]}
          intensity={2.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0003}
          shadow-radius={6}
        >
          <orthographicCamera attach="shadow-camera" args={[-7, 7, 7, -7, 0.5, 40]} />
        </directionalLight>
        {/* Rim light from behind, in the accent blue, to separate the subject from the paper. */}
        <directionalLight position={[-6, 4, -7]} intensity={1.6} color="#9DC3F5" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow>
          <planeGeometry args={[90, 90]} />
          <shadowMaterial transparent opacity={0.2} />
        </mesh>
        {children}
        
      </ThreeCanvas>
    </div>
  );
};

/** 0 to 1 over a few frames after `at`, eased: for parts that arrive on a cue. */
export function useArrive(at: number, len = 18) {
  const f = useCurrentFrame();
  return interpolate(f, [at, at + len], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1.25, 0.36, 1) });
}

let glowTex: THREE.Texture | null = null;
/** A soft round halo texture, made once. */
function haloTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/** A soft glow round a bright thing (a flame, a filament), always facing the camera. */
export const Glow: React.FC<{ color: string; size: number; opacity?: number; position?: Vec3 }> = ({ color, size, opacity = 0.7, position }) => (
  <sprite position={position} scale={[size, size, 1]}>
    <spriteMaterial map={haloTexture()} color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
  </sprite>
);
