/** Renders (Database Design → renders; API Design → Renders). One storyboard version turned into an MP4. */

export const RENDER_STATUSES = ["queued", "running", "ready", "failed"] as const;
export type RenderStatus = (typeof RENDER_STATUSES)[number];
/** Still being worked on: at most one per project. */
export const ACTIVE_STATUSES: RenderStatus[] = ["queued", "running"];

/** The steps of the render job, in order. */
export const RENDER_STAGES = ["voice", "setup", "render", "finish"] as const;
export type RenderStage = (typeof RENDER_STAGES)[number];

export const STAGE_LABELS: Record<RenderStage, string> = {
  voice: "Recording the voiceover",
  setup: "Getting the renderer ready",
  render: "Animating the scenes",
  finish: "Saving your video",
};

/** Where each stage starts on the overall progress bar (0 to 1). */
export const STAGE_START: Record<RenderStage, number> = { voice: 0, setup: 0.08, render: 0.3, finish: 0.95 };

export const RENDERS_RUNNING_MAX = 3;
export const RENDERS_PER_DAY = 10;

/** One suggested cover: a still of the video at `frame`. */
export type Cover = { key: string; frame: number; offsetMs: number };

/** How many cover frames are suggested. */
export const COVER_COUNT = 3;

export type RenderError = { code: string; message: string; stage: RenderStage };

export type RenderRecord = {
  id: string;
  userId: string;
  projectId: string;
  /** The storyboard version this render is of. */
  version: number;
  voiceId: string;
  voiceoverId: string | null;
  status: RenderStatus;
  stage: RenderStage;
  /** 0 to 1 across the whole render. */
  progress: number;
  durationSec: number | null;
  videoKey: string | null;
  /** The cover in use: one of `covers`, or the single thumbnail of a render made before covers existed. */
  thumbKey: string | null;
  /** The MP4's size in bytes, once saved. */
  bytes?: number | null;
  /** Suggested cover frames (API Design → covers), saved with the video. */
  covers?: Cover[] | null;
  /** Which of `covers` is the chosen one. */
  coverIndex?: number | null;
  /** The sandbox and command doing the work, so a later step (or the clean-up) can find them. */
  sandboxId: string | null;
  cmdId: string | null;
  error: RenderError | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

/** What the browser gets. */
export type Render = {
  id: string;
  projectId: string;
  version: number;
  status: RenderStatus;
  stage: RenderStage;
  stageLabel: string;
  progress: number;
  durationSec: number | null;
  videoUrl: string | null;
  /** Saves the MP4 (Content-Disposition: attachment). */
  downloadUrl: string | null;
  thumbnailUrl: string | null;
  voiceId: string;
  bytes: number | null;
  covers: { url: string; offsetMs: number }[];
  coverIndex: number;
  error: { code: string; message: string; stage: RenderStage } | null;
  attempts: number;
  createdAt: string;
  finishedAt: string | null;
};

export function toRender(r: RenderRecord): Render {
  const ready = r.status === "ready";
  const coverIndex = r.coverIndex ?? 0;
  return {
    id: r.id,
    projectId: r.projectId,
    version: r.version,
    status: r.status,
    stage: r.stage,
    stageLabel: STAGE_LABELS[r.stage],
    progress: ready ? 1 : Math.max(0, Math.min(1, r.progress)),
    durationSec: r.durationSec,
    videoUrl: ready && r.videoKey ? `/api/renders/${r.id}/video` : null,
    downloadUrl: ready && r.videoKey ? `/api/renders/${r.id}/download` : null,
    // The cover number in the link, so a browser that cached the old cover fetches the new one.
    thumbnailUrl: ready && r.thumbKey ? `/api/renders/${r.id}/thumbnail?c=${coverIndex}` : null,
    voiceId: r.voiceId,
    bytes: r.bytes ?? null,
    covers: ready ? (r.covers ?? []).map((c, i) => ({ url: `/api/renders/${r.id}/covers/${i}`, offsetMs: c.offsetMs })) : [],
    coverIndex,
    error: r.error,
    attempts: r.attempts,
    createdAt: r.createdAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

export const renderPrefix = (userId: string, projectId: string, renderId: string) =>
  `users/${userId}/projects/${projectId}/renders/${renderId}/`;
