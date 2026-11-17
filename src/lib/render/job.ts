import "server-only";
import { ApiError } from "../api/errors";
import type { ProjectsRepo } from "../projects/repo";
import type { Storage } from "../storage";
import type { StoryboardRepo } from "../storyboard/repo";
import type { Voiceover, VoiceoverRecord } from "../voiceover/types";
import { FPS } from "@/video/format";
import type { VideoProps } from "@/video/types";
import type { RenderRepo } from "./repo";
import type { Renderer } from "./renderer";
import { renderPrefix, STAGE_START, type RenderRecord, type RenderStage } from "./types";

/**
 * The step tools the job needs. Inngest provides them in production (each step is its own request,
 * and finished steps are skipped on a retry); locally a small in-process runner does.
 */
export type Steps = {
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
  sleep(name: string, ms: number): Promise<void>;
};

export type JobDeps = {
  renders: RenderRepo;
  projects: ProjectsRepo;
  storyboards: StoryboardRepo;
  /** Records the narration (or finds the recording made for the same narration and voice). */
  recordVoice(userId: string, projectId: string, version: number): Promise<Voiceover>;
  voiceoverRecord(userId: string, id: string): Promise<VoiceoverRecord | null>;
  storage(): Storage;
  renderer(): Renderer;
  now?: () => Date;
  pollMs?: number;
};

/** How often the job checks on the render, and how long it waits before giving up. */
export const POLL_MS = 5000;
export const RENDER_TIMEOUT_MS = 15 * 60_000;
/** Audio links handed to the renderer must outlive the render. */
const AUDIO_LINK_SEC = 3 * 3600;

type Failure = { code: string; message: string };

/** Turns any error into the short message the Video page shows. */
function failureOf(err: unknown, fallback: Failure): Failure {
  if (err instanceof ApiError) return { code: err.code, message: err.message };
  return fallback;
}

/** Marks a render failed (from a step, or from Inngest's last-resort failure handler) and frees the project. */
export async function markFailed(deps: JobDeps, renderId: string, failure: Failure, stage?: RenderStage) {
  const now = (deps.now ?? (() => new Date()))();
  const r = await deps.renders.byId(renderId);
  if (!r || (r.status !== "queued" && r.status !== "running")) return;
  const updated = await deps.renders.update(
    renderId,
    { status: "failed", error: { ...failure, stage: stage ?? r.stage }, updatedAt: now, finishedAt: now, sandboxId: null },
    ["queued", "running"],
  );
  if (!updated) return;
  if (r.sandboxId) await deps.renderer().stop(r.sandboxId);
  await deps.projects.setRenderState(r.userId, r.projectId, { status: "attention", step: "generate", latestRenderId: r.id }, now);
}

/**
 * The render job: voice → machine → render → save. Every step reads the render again, so a retried
 * or duplicated step does no harm.
 */
export async function renderJob(steps: Steps, renderId: string, deps: JobDeps): Promise<{ status: string }> {
  const now = deps.now ?? (() => new Date());
  const pollMs = deps.pollMs ?? POLL_MS;
  const stage = (s: RenderStage, extra: Partial<RenderRecord> = {}) =>
    deps.renders.update(renderId, { stage: s, progress: STAGE_START[s], updatedAt: now(), ...extra }, ["running"]);

  const begun = await steps.run("begin", async () => {
    const t = now();
    const r = await deps.renders.update(
      renderId,
      { status: "running", stage: "voice", progress: 0, error: null, startedAt: t, updatedAt: t },
      ["queued"],
    );
    return r ? { userId: r.userId, projectId: r.projectId, version: r.version } : null;
  });
  if (!begun) return { status: "skipped" };
  const { userId, projectId, version } = begun;

  // 1. Voice: the same recording the preview plays, made now if it doesn't exist yet.
  const voice = await steps.run("voice", async () => {
    try {
      const v = await deps.recordVoice(userId, projectId, version);
      await deps.renders.update(renderId, { voiceoverId: v.id, durationSec: v.durationSec, updatedAt: now() }, ["running"]);
      return { ok: true as const, voiceoverId: v.id };
    } catch (err) {
      const f = failureOf(err, { code: "VOICE_FAILED", message: "Couldn't record the voice. Try again in a minute." });
      if (err instanceof ApiError && err.status >= 500) throw err; // a busy voice service: let the step retry
      return { ok: false as const, failure: f };
    }
  });
  if (!voice.ok) {
    await steps.run("voice-failed", () => markFailed(deps, renderId, voice.failure, "voice"));
    return { status: "failed" };
  }

  // 2. A machine with the video code on it.
  const { sandboxId } = await steps.run("setup", async () => {
    await stage("setup");
    const out = await deps.renderer().setup();
    await deps.renders.update(renderId, { sandboxId: out.sandboxId, updatedAt: now() }, ["running"]);
    return out;
  });

  // 3. Start the render.
  const started = await steps.run("start-render", async () => {
    const props = await propsFor(deps, userId, projectId, version, voice.voiceoverId);
    const { cmdId } = await deps.renderer().start(sandboxId, props);
    await stage("render", { cmdId });
    return { cmdId, thumbFrame: thumbFrameOf(props) };
  });

  // 4. Wait for it, a few seconds at a time.
  const polls = Math.ceil(RENDER_TIMEOUT_MS / pollMs);
  let failure: Failure | null = { code: "RENDER_TIMEOUT", message: "The render took too long. Try again." };
  for (let i = 0; i < polls; i++) {
    await steps.sleep(`wait-${i}`, pollMs);
    const p = await steps.run(`poll-${i}`, async () => {
      const res = await deps.renderer().poll(sandboxId, started.cmdId);
      if (res.state === "running") {
        const progress = STAGE_START.render + (STAGE_START.finish - STAGE_START.render) * Math.max(0, Math.min(1, res.progress));
        await deps.renders.update(renderId, { progress, updatedAt: now() }, ["running"]);
      }
      return res;
    });
    if (p.state === "done") {
      failure = null;
      break;
    }
    if (p.state === "failed") {
      console.error("[render] failed", renderId, p.message);
      failure = { code: "RENDER_FAILED", message: "Something went wrong while animating the video. Try again." };
      break;
    }
  }
  if (failure) {
    const f = failure;
    await steps.run("render-failed", () => markFailed(deps, renderId, f, "render"));
    return { status: "failed" };
  }

  // 5. Save the video and a thumbnail, then free the machine.
  await steps.run("save", async () => {
    await stage("finish");
    const props = await propsFor(deps, userId, projectId, version, voice.voiceoverId);
    const prefix = renderPrefix(userId, projectId, renderId);
    const videoKey = `${prefix}video.mp4`;
    const thumbKey = `${prefix}thumb.jpg`;
    await deps.renderer().save(sandboxId, { props, videoKey, thumbKey, thumbFrame: started.thumbFrame, storage: deps.storage() });
    const t = now();
    const done = await deps.renders.update(
      renderId,
      { status: "ready", progress: 1, videoKey, thumbKey, sandboxId: null, updatedAt: t, finishedAt: t },
      ["running"],
    );
    await deps.renderer().stop(sandboxId);
    if (done) await deps.projects.setRenderState(userId, projectId, { status: "ready", step: "generate", latestRenderId: renderId }, t);
  });
  return { status: "ready" };
}

/** The video's props: the storyboard version plus the recorded voice and its word timings. */
async function propsFor(deps: JobDeps, userId: string, projectId: string, version: number, voiceoverId: string): Promise<VideoProps> {
  const sb = await deps.storyboards.get(userId, projectId, version);
  const v = await deps.voiceoverRecord(userId, voiceoverId);
  if (!sb || !v) throw new Error("The storyboard or its voiceover is missing.");
  return {
    storyboard: sb.storyboard,
    words: v.words,
    audioSrc: await deps.storage().signedUrl(v.audioKey, AUDIO_LINK_SEC),
    durationSec: v.durationSec,
  };
}

/** A frame from the title scene, once its text has settled in. */
function thumbFrameOf(props: VideoProps): number {
  const total = Math.max(1, Math.ceil(props.durationSec * FPS));
  return Math.min(Math.round(1.5 * FPS), total - 1);
}

/** Runs the job in this process (local tests): steps run once, sleeps really sleep. */
export function inlineSteps(): Steps {
  return {
    run: (_name, fn) => fn(),
    sleep: (_name, ms) => new Promise((r) => setTimeout(r, ms)),
  };
}
