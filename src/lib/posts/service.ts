import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../api/errors";
import type { Publisher } from "../instagram";
import type { ProjectsRepo } from "../projects/repo";
import type { RenderRepo } from "../render/repo";
import type { StoryboardRepo } from "../storyboard/repo";
import { suggestCaption, type CaptionSuggestion } from "./caption";
import type { PostsRepo } from "./repo";
import {
  CAPTION_MAX,
  countHashtags,
  fullCaption,
  HASHTAGS_MAX,
  LOCK_BEFORE_MS,
  parseHashtags,
  SCHEDULE_MAX_MS,
  SCHEDULE_MIN_MS,
  toPost,
  type Post,
  type PostRecord,
  type PostStatus,
} from "./types";

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const createPostBody = z.object({
  renderId: z.string().min(1).max(64),
  caption: z.string().max(10_000).default(""),
  hashtags: z.array(z.string().max(200)).max(200).default([]),
  coverOffsetMs: z.number().int().min(0).max(10 * 60_000).optional(),
  mode: z.enum(["now", "scheduled"]),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  timeZone: z.string().max(64).refine(validZone, "unknown_time_zone").optional(),
  confirmRepost: z.boolean().optional(),
});
export type CreatePostBody = z.infer<typeof createPostBody>;

export const retryPostBody = z.object({
  mode: z.enum(["now", "scheduled"]),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  timeZone: z.string().max(64).refine(validZone, "unknown_time_zone").optional(),
});
export type RetryPostBody = z.infer<typeof retryPostBody>;

export const captionBody = z.object({ tone: z.string().max(200).optional() });

/** A post still "publishing" this long after it started was lost (the job died without its failure handler). */
export const STALE_PUBLISHING_MS = 30 * 60_000;
/** A scheduled post this long past its time never started. */
export const STALE_SCHEDULED_MS = 30 * 60_000;

type Deps = {
  posts: PostsRepo;
  projects: ProjectsRepo;
  renders: RenderRepo;
  storyboards: StoryboardRepo;
  publisher(userId: string): Promise<{ ok: true; publisher: Publisher } | { ok: false; reason: "not_connected" | "reconnect_needed" }>;
  /** Hands the post to the background job (Inngest, or the in-process runner locally). */
  dispatch(post: PostRecord): Promise<void>;
  /** Stops a sleeping run early (it would also stop by itself when it wakes). */
  cancelRun(post: PostRecord): Promise<void>;
  caption?: typeof suggestCaption;
  now?: () => Date;
};

/** Posts from the API Design (Posts section). */
export function postService({ posts, projects, renders, storyboards, publisher, dispatch, cancelRun, caption = suggestCaption, now = () => new Date() }: Deps) {
  const token = () => randomBytes(9).toString("base64url");

  /** Checks the caption and hashtags against Instagram's limits; returns the cleaned hashtags. */
  function checkText(captionText: string, rawTags: string[]): { caption: string; hashtags: string[] } {
    const hashtags = parseHashtags(rawTags.join(" "));
    const text = captionText.replace(/\r\n/g, "\n").trim();
    const full = fullCaption(text, hashtags);
    if (full.length > CAPTION_MAX) {
      throw new ApiError("CAPTION_TOO_LONG", `Instagram allows ${CAPTION_MAX.toLocaleString("en-GB")} characters, hashtags included.`, {
        length: full.length,
        max: CAPTION_MAX,
      });
    }
    const n = countHashtags(full);
    if (n > HASHTAGS_MAX) {
      throw new ApiError("TOO_MANY_HASHTAGS", `Instagram allows ${HASHTAGS_MAX} hashtags.`, { count: n, max: HASHTAGS_MAX });
    }
    return { caption: text, hashtags };
  }

  /** The time a post goes out: now, or a scheduled time 10 minutes to 60 days ahead. */
  function timeOf(mode: "now" | "scheduled", scheduledAt: string | undefined, t: Date): Date {
    if (mode === "now") return t;
    if (!scheduledAt) throw new ApiError("VALIDATION_FAILED", "Pick a date and time.", { scheduledAt: "required" });
    const at = new Date(scheduledAt);
    const min = t.getTime() + SCHEDULE_MIN_MS;
    const max = t.getTime() + SCHEDULE_MAX_MS;
    if (at.getTime() < min || at.getTime() > max) {
      // Rounded up to the next whole 5 minutes, so it's a time someone would pick.
      const near = at.getTime() < min ? Math.ceil((min + 60_000) / 300_000) * 300_000 : Math.floor(max / 300_000) * 300_000;
      throw new ApiError(
        "SCHEDULE_OUT_OF_RANGE",
        at.getTime() < min ? "Pick a time at least 10 minutes from now." : "Pick a time within the next 60 days.",
        { nearestValid: new Date(near).toISOString() },
      );
    }
    return at;
  }

  async function needInstagram(userId: string): Promise<Publisher> {
    const p = await publisher(userId);
    if (p.ok) return p.publisher;
    if (p.reason === "reconnect_needed") {
      throw new ApiError("INSTAGRAM_RECONNECT_NEEDED", "Instagram asked for your account to be connected again.");
    }
    throw new ApiError("INSTAGRAM_NOT_CONNECTED", "Connect your Instagram account to post.");
  }

  /** A post whose job was lost is failed, so it can be tried again rather than wait forever. */
  async function expireIfStale(p: PostRecord): Promise<PostRecord> {
    const t = now();
    const stale =
      (p.status === "publishing" && t.getTime() - p.updatedAt.getTime() > STALE_PUBLISHING_MS) ||
      (p.status === "scheduled" && t.getTime() - p.scheduledAt.getTime() > STALE_SCHEDULED_MS);
    if (!stale) return p;
    const failed = await posts.update(
      p.id,
      {
        status: "failed",
        error: { code: "IG_UNAVAILABLE", message: "This post didn't go out. Check Instagram, then try again." },
        updatedAt: t,
      },
      [p.status],
    );
    if (!failed) return (await posts.byId(p.id)) ?? p;
    console.error("[post] gave up on a stuck post", p.id, p.status);
    await projects.setRenderState(p.userId, p.projectId, { status: "attention", step: "post" }, t);
    return failed;
  }

  /** Starts the job; a job that can't start fails the post at once rather than leaving it waiting. */
  async function start(p: PostRecord) {
    try {
      await dispatch(p);
    } catch (err) {
      console.error("[post] could not start the job", p.id, err);
      const t = now();
      await posts.update(
        p.id,
        { status: "failed", error: { code: "IG_UNAVAILABLE", message: "Couldn't start posting. Try again." }, updatedAt: t },
        ["scheduled", "publishing"],
      );
      await projects.setRenderState(p.userId, p.projectId, { status: "attention", step: "post" }, t);
      throw new ApiError("INTERNAL", "Couldn't start posting. Try again.");
    }
  }

  /** The project's status once a post goes back to not waiting (cancelled): ready, or posted if an earlier post went out. */
  async function settledStatus(userId: string, projectId: string, renderId: string) {
    return (await posts.postedForRender(userId, renderId)) ? ("posted" as const) : ("ready" as const);
  }

  return {
    /** Watchdog (every 15 minutes): fails posts whose job was lost, so they can be tried again. Returns how many. */
    async sweep(limit = 100): Promise<number> {
      const stuck = await posts.listStuck(new Date(now().getTime() - Math.min(STALE_PUBLISHING_MS, STALE_SCHEDULED_MS)), limit);
      let n = 0;
      for (const p of stuck) if ((await expireIfStale(p)).status === "failed") n++;
      return n;
    },
    /** POST /api/projects/:id/caption */
    async caption(userId: string, projectId: string, tone?: string): Promise<CaptionSuggestion> {
      const p = await projects.get(userId, projectId);
      if (!p) throw new ApiError("NOT_FOUND");
      const r = p.latestRenderId ? await renders.get(userId, p.latestRenderId) : null;
      const version = r?.version ?? p.currentVersion;
      const v = version > 0 ? await storyboards.get(userId, projectId, version) : null;
      if (!v) throw new ApiError("STORYBOARD_INVALID", "Finish the storyboard first.");
      return caption(v.storyboard, { durationSec: r?.durationSec, tone });
    },

    /** POST /api/projects/:id/posts */
    async create(userId: string, projectId: string, body: CreatePostBody, idempotencyKey: string | null): Promise<{ post: Post; created: boolean }> {
      if (idempotencyKey) {
        const seen = await posts.byIdempotencyKey(userId, idempotencyKey);
        if (seen) {
          if (seen.projectId !== projectId) throw new ApiError("VALIDATION_FAILED", "That request key was already used.", { idempotencyKey: "reused" });
          return { post: toPost(seen), created: false };
        }
      }
      const project = await projects.get(userId, projectId);
      if (!project) throw new ApiError("NOT_FOUND");
      const render = await renders.get(userId, body.renderId);
      if (!render || render.projectId !== projectId || render.status !== "ready" || !render.videoKey) {
        throw new ApiError("RENDER_NOT_READY", "This video isn't ready to post yet.");
      }
      if (project.latestRenderId !== render.id) {
        throw new ApiError("RENDER_NOT_LATEST", "There's a newer version of this video. Post that one instead.", {
          latestRenderId: project.latestRenderId,
        });
      }
      const ig = await needInstagram(userId);
      const text = checkText(body.caption, body.hashtags);
      const t = now();
      const at = timeOf(body.mode, body.scheduledAt, t);

      const active = await posts.activeForProject(userId, projectId);
      if (active) {
        const current = await expireIfStale(active);
        if (current.status === "scheduled" || current.status === "publishing") {
          throw new ApiError("ALREADY_POSTED", current.status === "scheduled" ? "This video is already scheduled. Cancel that post first." : "This video is being posted right now.", {
            postId: current.id,
            status: current.status,
          });
        }
      }
      const done = await posts.postedForRender(userId, render.id);
      if (done && !body.confirmRepost) {
        throw new ApiError("ALREADY_POSTED", "This video is already on Instagram. Post it again?", {
          postId: done.id,
          status: "posted",
          permalink: done.permalink,
        });
      }

      const covers = render.covers ?? [];
      const coverOffsetMs = Math.min(
        body.coverOffsetMs ?? covers[render.coverIndex ?? 0]?.offsetMs ?? 0,
        Math.max(0, Math.floor((render.durationSec ?? 0) * 1000) - 100),
      );
      const record: PostRecord = {
        id: posts.newId(),
        userId,
        projectId,
        renderId: render.id,
        ...text,
        coverOffsetMs: Math.max(0, coverOffsetMs),
        mode: body.mode,
        scheduledAt: at,
        timeZone: body.timeZone ?? null,
        status: body.mode === "now" ? "publishing" : "scheduled",
        igUserId: ig.igUserId,
        igUsername: ig.username,
        containerId: null,
        mediaId: null,
        permalink: null,
        error: null,
        runToken: token(),
        idempotencyKey,
        attempts: 1,
        createdAt: t,
        updatedAt: t,
        postedAt: null,
      };
      const ins = await posts.insert(record);
      if (!ins.ok) {
        if (ins.reason === "idempotent" && idempotencyKey) {
          const seen = await posts.byIdempotencyKey(userId, idempotencyKey);
          if (seen) return { post: toPost(seen), created: false };
        }
        throw new ApiError("ALREADY_POSTED", "This video is already scheduled. Cancel that post first.", { status: "scheduled" });
      }
      if (body.mode === "scheduled") await projects.setRenderState(userId, projectId, { status: "scheduled", step: "post" }, t);
      else await projects.setRenderState(userId, projectId, { step: "post" }, t);
      await start(record);
      return { post: toPost(record), created: true };
    },

    /** GET /api/posts/:id */
    async get(userId: string, id: string): Promise<Post> {
      const p = await posts.get(userId, id);
      if (!p) throw new ApiError("NOT_FOUND");
      return toPost(await expireIfStale(p));
    },

    /** The video's newest post, for step 4. */
    async latest(userId: string, projectId: string): Promise<Post | null> {
      if (!(await projects.get(userId, projectId))) throw new ApiError("NOT_FOUND");
      const p = await posts.latestForProject(userId, projectId);
      return p ? toPost(await expireIfStale(p)) : null;
    },

    /** GET /api/posts */
    async list(userId: string, opts: { from: Date; to: Date; statuses?: PostStatus[] }): Promise<Post[]> {
      const items = await posts.list(userId, opts);
      return Promise.all(items.map(async (p) => toPost(await expireIfStale(p))));
    },

    /** POST /api/posts/:id/cancel: only a scheduled post, and not in its last 5 minutes. */
    async cancel(userId: string, id: string): Promise<Post> {
      const p = await posts.get(userId, id);
      if (!p) throw new ApiError("NOT_FOUND");
      const t = now();
      if (p.status === "held") {
        const c = await posts.update(id, { status: "cancelled", updatedAt: t }, ["held"]);
        if (c) {
          await projects.setRenderState(userId, p.projectId, { status: await settledStatus(userId, p.projectId, p.renderId) }, t);
          return toPost(c);
        }
      }
      if (p.status !== "scheduled" || p.scheduledAt.getTime() - t.getTime() < LOCK_BEFORE_MS) {
        throw new ApiError("POST_LOCKED", p.status === "scheduled" ? "It's too close to the posting time to cancel." : "This post can't be cancelled now.");
      }
      const c = await posts.update(id, { status: "cancelled", updatedAt: t }, ["scheduled"]);
      if (!c) throw new ApiError("POST_LOCKED", "This post can't be cancelled now.");
      await cancelRun(c).catch((err) => console.error("[post] cancel event failed", id, err));
      await projects.setRenderState(userId, p.projectId, { status: await settledStatus(userId, p.projectId, p.renderId) }, t);
      return toPost(c);
    },

    /** POST /api/posts/:id/retry: a failed post, or a held one once Instagram is connected again. */
    async retry(userId: string, id: string, body: RetryPostBody): Promise<Post> {
      const p = await posts.get(userId, id);
      if (!p) throw new ApiError("NOT_FOUND");
      if (p.status !== "failed" && p.status !== "held") throw new ApiError("NOT_RETRYABLE", "Only a post that didn't go out can be tried again.");
      const project = await projects.get(userId, p.projectId);
      if (!project) throw new ApiError("NOT_FOUND");
      if (project.latestRenderId !== p.renderId) {
        throw new ApiError("RENDER_NOT_LATEST", "There's a newer version of this video. Post that one instead.", {
          latestRenderId: project.latestRenderId,
        });
      }
      const ig = await needInstagram(userId);
      const t = now();
      const at = timeOf(body.mode, body.scheduledAt, t);
      const updated = await posts.update(
        id,
        {
          status: body.mode === "now" ? "publishing" : "scheduled",
          mode: body.mode,
          scheduledAt: at,
          timeZone: body.timeZone ?? p.timeZone,
          igUserId: ig.igUserId,
          igUsername: ig.username,
          containerId: null,
          mediaId: null,
          error: null,
          runToken: token(),
          attempts: p.attempts + 1,
          updatedAt: t,
        },
        ["failed", "held"],
      );
      if (!updated) {
        const active = await posts.activeForProject(userId, p.projectId);
        if (active) throw new ApiError("ALREADY_POSTED", "This video already has a post waiting.", { postId: active.id, status: active.status });
        throw new ApiError("NOT_RETRYABLE", "Only a post that didn't go out can be tried again.");
      }
      await projects.setRenderState(userId, p.projectId, { status: body.mode === "scheduled" ? "scheduled" : project.status === "attention" ? "ready" : project.status, step: "post" }, t);
      await start(updated);
      return toPost(updated);
    },

    /** DELETE /api/instagram: waiting posts can't go out without an account. */
    async holdAll(userId: string): Promise<number> {
      const t = now();
      const projectIds = await posts.holdScheduled(userId, t);
      for (const id of new Set(projectIds)) await projects.setRenderState(userId, id, { status: "attention", step: "post" }, t);
      return projectIds.length;
    },
  };
}

export type PostService = ReturnType<typeof postService>;
