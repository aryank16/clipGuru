import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
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
import { Scene3DScene } from "./scenes/Scene3DScene";
import { Background } from "./components/Background";
import { OVERLAP, SceneMotion, transitionAfter } from "./components/motion";

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
    case "scene3d":
      return <Scene3DScene scene={scene} timing={timing} />;
  }
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
        const last = i === storyboard.scenes.length - 1;
        // Each scene stays on a little into the next one, so the two can hand over together.
        return (
          <Sequence key={i} from={from} durationInFrames={frames + (last ? 0 : OVERLAP)} name={`${i + 1}. ${scene.type}`}>
            <SceneMotion frames={frames} enter={i === 0 ? "first" : transitionAfter(i - 1)} exit={last ? null : transitionAfter(i)}>
              <SceneSwitch scene={scene} timing={t} />
            </SceneMotion>
          </Sequence>
        );
      })}
      <Captions words={words} />
      <ProgressBar />
    </AbsoluteFill>
  );
};
