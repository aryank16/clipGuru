import "server-only";
import { ApiError } from "../api/errors";
import type { ProjectsRepo } from "../projects/repo";
import type { StoryboardRepo } from "../storyboard/repo";
import { MIN_SCENES } from "../storyboard/types";
import type { RenderRepo } from "./repo";
import { RENDERS_PER_DAY, RENDERS_RUNNING_MAX, toRender, type Render, type RenderRecord } from "./types";

const DAY_MS = 24 * 3600 * 1000;
/**
 * A render with no news for this long is treated as lost (the job never started, or died without its
 * failure handler) and failed, so the person can try again. A running job reports at least every
 * few seconds while it renders; setting up the machine is the longest quiet spell (a few minutes).
 */
export const STALE_QUEUED_MS = 10 * 60_000;
export const STALE_RUNNING_MS = 25 * 60_000;

type Deps = {
  renders: RenderRepo;
  projects: ProjectsRepo;
  storyboards: StoryboardRepo;
  /** Hands the render to the background job (Inngest, or the in-process runner locally). */
  dispatch(render: RenderRecord): Promise<void>;
  now?: () => Date;
};

/** Renders from the API Design (Renders section). */
export function renderService({ renders, projects, storyboards, dispatch, now = () => new Date() }: Deps) {
  /** How many of the person's renders are really running, after failing any that are stuck. */
  async function activeCount(userId: string): Promise<number> {
    const n = await renders.countActive(userId);
    if (n < RENDERS_RUNNING_MAX) return n;
    for (const r of await renders.listActive(userId)) await expireIfStale(r);
    return renders.countActive(userId);
  }

  async function limits(userId: string, t: Date) {
    if ((await activeCount(userId)) >= RENDERS_RUNNING_MAX) {
      throw new ApiError("LIMIT_REACHED", `You already have ${RENDERS_RUNNING_MAX} videos rendering. Wait for one to finish.`, {
        limit: "renders_running",
        max: RENDERS_RUNNING_MAX,
        retryAfterSec: 60,
      });
    }
    if ((await renders.countSince(userId, new Date(t.getTime() - DAY_MS))) >= RENDERS_PER_DAY) {
      throw new ApiError("LIMIT_REACHED", `You've made ${RENDERS_PER_DAY} videos today. Try again tomorrow.`, {
        limit: "renders_per_day",
        max: RENDERS_PER_DAY,
        retryAfterSec: 3600,
      });
    }
  }

  /** Fails a render that has been queued or running far too long. Returns the render as it now stands. */
  async function expireIfStale(r: RenderRecord): Promise<RenderRecord> {
    const limit = r.status === "queued" ? STALE_QUEUED_MS : r.status === "running" ? STALE_RUNNING_MS : null;
    const t = now();
    if (limit === null || t.getTime() - r.updatedAt.getTime() < limit) return r;
    const failed = await renders.update(
      r.id,
      {
        status: "failed",
        error: { code: "RENDER_TIMEOUT", message: "The video stopped making progress. Try again.", stage: r.stage },
        updatedAt: t,
        finishedAt: t,
        sandboxId: null,
      },
      [r.status],
    );
    if (!failed) return (await renders.byId(r.id)) ?? r; // the job moved it on just now
    console.error("[render] gave up on a stuck render", r.id, r.status, r.stage);
    await projects.setRenderState(r.userId, r.projectId, { status: "attention", step: "generate", latestRenderId: r.id }, t);
    return failed;
  }

  /** The project's active render, after failing it if it is stuck. */
  async function activeFor(userId: string, projectId: string): Promise<RenderRecord | null> {
    const r = await renders.activeForProject(userId, projectId);
    if (!r) return null;
    const current = await expireIfStale(r);
    return current.status === "queued" || current.status === "running" ? current : null;
  }

  async function running(userId: string, projectId: string): Promise<never> {
    const active = await renders.activeForProject(userId, projectId);
    throw new ApiError("RENDER_RUNNING", "This video is already being made.", active ? { renderId: active.id } : undefined);
  }

  return {
    /** POST /api/projects/:id/renders: makes the video of the current storyboard version. */
    async create(userId: string, projectId: string): Promise<Render> {
      const p = await projects.get(userId, projectId);
      if (!p) throw new ApiError("NOT_FOUND");
      const v = p.currentVersion > 0 ? await storyboards.get(userId, projectId, p.currentVersion) : null;
      if (!v || v.storyboard.scenes.length < MIN_SCENES) {
        throw new ApiError("STORYBOARD_INVALID", "Finish the storyboard first.");
      }
      if (await activeFor(userId, projectId)) await running(userId, projectId);
      const t = now();
      await limits(userId, t);

      const record: RenderRecord = {
        id: renders.newId(),
        userId,
        projectId,
        version: v.version,
        voiceId: p.voiceId,
        voiceoverId: null,
        status: "queued",
        stage: "voice",
        progress: 0,
        durationSec: null,
        videoKey: null,
        thumbKey: null,
        sandboxId: null,
        cmdId: null,
        error: null,
        attempts: 1,
        createdAt: t,
        updatedAt: t,
        startedAt: null,
        finishedAt: null,
      };
      if (!(await renders.insert(record))) await running(userId, projectId);
      await projects.setRenderState(userId, projectId, { status: "generating", step: "generate", latestRenderId: record.id }, t);
      await start(record);
      return toRender(record);
    },

    /** GET /api/renders/:id */
    async get(userId: string, id: string): Promise<Render> {
      const r = await renders.get(userId, id);
      if (!r) throw new ApiError("NOT_FOUND");
      return toRender(await expireIfStale(r));
    },

    /** The project's newest render, for the Video page. */
    async latest(userId: string, projectId: string): Promise<Render | null> {
      if (!(await projects.get(userId, projectId))) throw new ApiError("NOT_FOUND");
      const r = await renders.latestForProject(userId, projectId);
      return r ? toRender(await expireIfStale(r)) : null;
    },

    /** POST /api/renders/:id/retry: only a failed render. Starts over; the voice is reused. */
    async retry(userId: string, id: string): Promise<Render> {
      const r = await renders.get(userId, id);
      if (!r) throw new ApiError("NOT_FOUND");
      if (r.status !== "failed") throw new ApiError("NOT_RETRYABLE", "Only a failed video can be tried again.");
      if (await activeFor(userId, r.projectId)) await running(userId, r.projectId);
      const t = now();
      if ((await activeCount(userId)) >= RENDERS_RUNNING_MAX) await limits(userId, t);
      const updated = await renders.update(
        id,
        { status: "queued", stage: "voice", progress: 0, error: null, attempts: r.attempts + 1, updatedAt: t, finishedAt: null },
        ["failed"],
      );
      if (!updated) throw new ApiError("NOT_RETRYABLE", "Only a failed video can be tried again.");
      await projects.setRenderState(userId, r.projectId, { status: "generating", step: "generate", latestRenderId: id }, t);
      await start(updated);
      return toRender(updated);
    },
  };

  /** A render that can't be handed to the job is failed at once rather than left queued forever. */
  async function start(r: RenderRecord) {
    try {
      await dispatch(r);
    } catch (err) {
      console.error("[render] could not start the job", r.id, err);
      const t = now();
      await renders.update(
        r.id,
        {
          status: "failed",
          error: { code: "RENDER_FAILED", message: "Couldn't start making the video. Try again.", stage: "voice" },
          updatedAt: t,
          finishedAt: t,
        },
        ["queued"],
      );
      await projects.setRenderState(r.userId, r.projectId, { status: "attention" }, t);
      throw new ApiError("INTERNAL", "Couldn't start making the video. Try again.");
    }
  }
}
