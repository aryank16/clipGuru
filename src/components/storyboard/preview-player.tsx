"use client";

import { Player, type PlayerRef } from "@remotion/player";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import type { Storyboard } from "@/lib/storyboard/types";
import { Explainer } from "@/video/Explainer";
import { FPS, HEIGHT, WIDTH } from "@/video/theme";
import { computeSceneTimings, estimateWords } from "@/video/timing";
import type { VideoProps, Word } from "@/video/types";

export type PreviewHandle = { playScene: (index: number) => void };

/** A recorded voiceover: the audio and when each narration word is spoken. */
export type PreviewVoice = { audioSrc: string; words: Word[]; durationSec: number };

/**
 * The storyboard played with the real video scenes. With a voiceover the scenes follow the spoken
 * words; without one it is silent, with timing estimated from the narration. Loaded only in the browser.
 */
export default function PreviewPlayer({
  storyboard,
  voice,
  onScene,
  onReady,
  control,
}: {
  storyboard: Storyboard;
  voice: PreviewVoice | null;
  onScene: (index: number) => void;
  onReady: () => void;
  control: RefObject<PreviewHandle | null>;
}) {
  const player = useRef<PlayerRef>(null);
  const props = useMemo((): VideoProps => {
    if (voice) return { storyboard, words: voice.words, audioSrc: voice.audioSrc, durationSec: voice.durationSec };
    const est = estimateWords(storyboard.scenes);
    return {
      storyboard,
      words: est.words,
      audioSrc: null,
      durationSec: est.durationSec,
    };
  }, [storyboard, voice]);
  const starts = useMemo(
    () =>
      computeSceneTimings(
        props.storyboard.scenes,
        props.words,
        props.durationSec,
      ).map((t) => Math.round(t.startSec * FPS)),
    [props],
  );

  useImperativeHandle(control, () => ({
    playScene(index: number) {
      const p = player.current;
      if (!p || starts[index] === undefined) return;
      // A moment in, once the scene has faded in (its start is just before its first word and
      // still shows the last scene's caption).
      const next = starts[index + 1] ?? Math.ceil(props.durationSec * FPS);
      p.seekTo(Math.min(starts[index] + 12, Math.max(starts[index], next - 1)));
      p.play();
    },
  }));

  // Lets the page replay a scene chip pressed while the player was still loading.
  useEffect(() => onReady(), [onReady]);

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    let last = -1;
    const onFrame = (e: { detail: { frame: number } }) => {
      let i = 0;
      while (i + 1 < starts.length && e.detail.frame >= starts[i + 1]) i++;
      if (i !== last) {
        last = i;
        onScene(i);
      }
    };
    p.addEventListener("frameupdate", onFrame);
    return () => p.removeEventListener("frameupdate", onFrame);
  }, [starts, onScene]);

  return (
    <Player
      ref={player}
      component={Explainer as unknown as React.FC<Record<string, unknown>>}
      inputProps={props as unknown as Record<string, unknown>}
      durationInFrames={Math.max(1, Math.ceil(props.durationSec * FPS))}
      fps={FPS}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      controls
      // Opens on the title card fully drawn, not on the blank first frame.
      initialFrame={Math.min(45, Math.max(0, Math.ceil(props.durationSec * FPS) - 1))}
      clickToPlay
      doubleClickToFullscreen
      acknowledgeRemotionLicense
      style={{
        width: "100%",
        aspectRatio: "9 / 16",
        borderRadius: 8,
        overflow: "hidden",
      }}
    />
  );
}
