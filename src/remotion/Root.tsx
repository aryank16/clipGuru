import React from "react";
import { Composition } from "remotion";
import { Explainer } from "../video/Explainer";
import { FPS, HEIGHT, WIDTH } from "../video/theme";
import type { VideoProps } from "../video/types";

/** The renderer asks for this id (COMPOSITION_ID in src/lib/render/renderer.ts). */
const COMPOSITION_ID = "Explainer";

const sample: VideoProps = {
  storyboard: { topic: "Sample", title: "Sample", scenes: [{ type: "title", narration: "A sample video.", title: "Sample", subtitle: "", icon: "sparkles" }] },
  words: [],
  audioSrc: null,
  durationSec: 3,
};

export const Root: React.FC = () => (
  <Composition
    id={COMPOSITION_ID}
    component={Explainer as unknown as React.FC<Record<string, unknown>>}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={Math.ceil(sample.durationSec * FPS)}
    defaultProps={sample as unknown as Record<string, unknown>}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.ceil(((props as unknown as VideoProps).durationSec || 1) * FPS)),
    })}
  />
);
