import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  Easing,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Scene, SceneTiming, VideoProps } from "./types";
import { theme } from "./theme";
import { computeSceneTimings } from "./timing";
import { Captions } from "./components/Captions";
import { TitleScene } from "./scenes/TitleScene";
import { IconListScene } from "./scenes/IconListScene";
import { CycleScene } from "./scenes/CycleScene";
import { FlowScene } from "./scenes/FlowScene";
import { FocusScene } from "./scenes/FocusScene";
import { StatScene } from "./scenes/StatScene";
import { SummaryScene } from "./scenes/SummaryScene";
import { ArraySearchScene } from "./scenes/ArraySearchScene";
import { Background } from "./components/Background";

const SceneSwitch: React.FC<{ scene: Scene; timing: SceneTiming }> = ({ scene, timing }) => {
  switch (scene.type) {
    case "title":
      return <TitleScene scene={scene} timing={timing} />;
    case "iconList":
      return <IconListScene scene={scene} timing={timing} />;
    case "cycle":
      return <CycleScene scene={scene} timing={timing} />;
    case "flow":
      return <FlowScene scene={scene} timing={timing} />;
    case "focus":
      return <FocusScene scene={scene} timing={timing} />;
    case "stat":
      return <StatScene scene={scene} timing={timing} />;
    case "summary":
      return <SummaryScene scene={scene} timing={timing} />;
    case "arraySearch":
      return <ArraySearchScene scene={scene} timing={timing} />;
  }
};

// Fades each scene in and out so cuts feel calm.
const SceneShell: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  const out = interpolate(f, [frames - 9, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const inn = interpolate(f, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(f, [0, 14], [36, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const sink = interpolate(f, [frames - 9, frames], [0, -24], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: Math.min(out, inn), transform: `translateY(${rise + sink}px)` }}>{children}</AbsoluteFill>
  );
};

const ProgressBar: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: theme.line }}>
      <div style={{ height: "100%", width: `${(f / durationInFrames) * 100}%`, background: theme.accent }} />
    </div>
  );
};

export const Explainer: React.FC<VideoProps> = ({ storyboard, words, audioSrc, durationSec }) => {
  const { fps } = useVideoConfig();
  const timings = useMemo(
    () => computeSceneTimings(storyboard.scenes, words, durationSec),
    [storyboard, words, durationSec],
  );
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.font }}>
      <Background />
      {audioSrc && <Audio src={/^(https?:|\/)/.test(audioSrc) ? audioSrc : staticFile(audioSrc)} />}
      {storyboard.scenes.map((scene, i) => {
        const t = timings[i];
        const from = Math.round(t.startSec * fps);
        const frames = Math.max(1, Math.round(t.endSec * fps) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={frames} name={`${i + 1}. ${scene.type}`}>
            <SceneShell frames={frames}>
              <SceneSwitch scene={scene} timing={t} />
            </SceneShell>
          </Sequence>
        );
      })}
      <Captions words={words} />
      <ProgressBar />
    </AbsoluteFill>
  );
};
