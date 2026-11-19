import "server-only";
import type { InstagramClient } from "../instagram/client";
import { MetaError } from "../instagram/client";
import type { Publisher } from "../instagram";
import type { ProjectsRepo } from "../projects/repo";
import type { RenderRepo } from "../render/repo";
import type { Storage } from "../storage";
import type { PostsRepo } from "./repo";
import { fullCaption, type PostError, type PostRecord } from "./types";

/** Step tools: Inngest in production (each step its own request, skipped on a retry); in-process locally. */
export type PostSteps = {
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
  sleep(name: string, ms: number): Promise<void>;
  sleepUntil(name: string, at: Date): Promise<void>;
};

export type PublishDeps = {
  posts: PostsRepo;
  projects: ProjectsRepo;
  renders: RenderRepo;
  storage(): Storage;
  client(): InstagramClient | null;
  publisher(userId: string): Promise<{ ok: true; publisher: Publisher } | { ok: false; reason: "not_connected" | "reconnect_needed" }>;
  markReconnectNeeded(userId: string, at: Date): Promise<void>;
  now?: () => Date;
  pollMs?: number;
};

export type PostRequested = { postId: string; userId: string; runToken: string };

/** How often Meta's processing is checked, and for how long. */
export const PROCESS_POLL_MS = 10_000;
export const PROCESS_MAX_POLLS = 60;
/** Inngest's free plan sleeps at most 7 days at a time, so long waits go in hops. */
export const SLEEP_HOP_MS = 6 * 24 * 3600_000;
/** Meta fetches the video from this link while it processes the Reel. */
const VIDEO_LINK_SEC = 6 * 3600;

const RECONNECT: PostError = { code: "IG_RECONNECT", message: "Instagram asked for the account to be connected again. Reconnect, then try again." };
const UNAVAILABLE: PostError = { code: "IG_UNAVAILABLE", message: "Instagram didn't respond. Try again in a few minutes." };

/** Thrown inside a step for a failure worth retrying (Meta busy or down). */
class Transient extends Error {}

/** What a Meta error means for the post: retry, ask to reconnect, or a final failure. */
export function classify(err: unknown): { kind: "transient" } | { kind: "reconnect" } | { kind: "final"; error: PostError } {
  if (!(err instanceof MetaError)) return { kind: "transient" };
  if (err.code === 190 || err.code === 102 || err.code === 10 || (err.code !== undefined && err.code >= 200 && err.code < 300)) {
    return { kind: "reconnect" };
  }
  if (err.subcode === 2207042 || err.code === 9) {
    return {
      kind: "final",
      error: { code: "IG_DAILY_LIMIT", message: "This Instagram account has reached its posting limit for today. Try again tomorrow." },
    };
  }
  if (err.status >= 500 || err.code === 1 || err.code === 2 || err.code === 4 || err.code === 17 || err.code === 32 || err.code === 613) {
    return { kind: "transient" };
  }
  return { kind: "final", error: { code: "IG_REJECTED", message: `Instagram didn't accept the video: ${err.message}`.slice(0, 300) } };
}

/**
 * Ends a post that can't go out (from a step, or Inngest's last-resort handler). Only while it is
 * still waiting or sending, and only for the run that owns it.
 */
export async function markPostFailed(deps: PublishDeps, postId: string, error: PostError, runToken?: string) {
  const now = (deps.now ?? (() => new Date()))();
  const p = await deps.posts.byId(postId);
  if (!p || (runToken && p.runToken !== runToken)) return;
  const status = error.code === "IG_RECONNECT" ? "held" : "failed";
  const updated = await deps.posts.update(postId, { status, error, updatedAt: now }, ["scheduled", "publishing"]);
  if (updated) await deps.projects.setRenderState(p.userId, p.projectId, { status: "attention", step: "post" }, now);
}

type Outcome = { status: "posted" | "failed" | "held" | "skipped" | "cancelled" };

/**
 * The publishing job: wait for the time → hand Meta the video → wait while it processes →
 * publish → save the link. Every step reads the post again, so a retried step does no harm.
 */
export async function publishJob(steps: PostSteps, req: PostRequested, deps: PublishDeps): Promise<Outcome> {
  const now = deps.now ?? (() => new Date());
  const pollMs = deps.pollMs ?? PROCESS_POLL_MS;
  const mine = (p: PostRecord | null): p is PostRecord => !!p && p.runToken === req.runToken;

  const start = await steps.run("load", async () => {
    const p = await deps.posts.byId(req.postId);
    return mine(p) ? { at: p.scheduledAt.toISOString(), since: now().toISOString() } : null;
  });
  if (!start) return { status: "skipped" };

  // 1. Wait for the time, in hops.
  const at = new Date(start.at);
  for (let hop = 1, t = new Date(start.since).getTime(); t < at.getTime(); hop++) {
    t = Math.min(at.getTime(), t + SLEEP_HOP_MS);
    await steps.sleepUntil(`wait-${hop}`, new Date(t));
  }

  const fail = (error: PostError) => steps.run("failed", () => markPostFailed(deps, req.postId, error, req.runToken));
  const reconnect = (userId: string) =>
    steps.run("reconnect-needed", async () => {
      await deps.markReconnectNeeded(userId, now());
      await markPostFailed(deps, req.postId, RECONNECT, req.runToken);
    });

  // 2. Still wanted? Then it's sending.
  const begun = await steps.run("begin", async () => {
    const p = await deps.posts.byId(req.postId);
    if (!mine(p) || (p.status !== "scheduled" && p.status !== "publishing")) return { go: false as const, why: "skipped" as const };
    const t = now();
    if (!(await deps.projects.get(p.userId, p.projectId))) {
      // The video was deleted while the post waited.
      await deps.posts.update(p.id, { status: "cancelled", updatedAt: t }, ["scheduled", "publishing"]);
      return { go: false as const, why: "cancelled" as const };
    }
    const pub = await deps.publisher(p.userId);
    if (!pub.ok) return { go: false as const, why: "reconnect" as const, userId: p.userId };
    await deps.posts.update(
      p.id,
      { status: "publishing", igUserId: pub.publisher.igUserId, igUsername: pub.publisher.username, updatedAt: t },
      ["scheduled", "publishing"],
    );
    return { go: true as const, userId: p.userId };
  });
  if (!begun.go) {
    if (begun.why === "reconnect") {
      await steps.run("held", () => markPostFailed(deps, req.postId, RECONNECT, req.runToken));
      return { status: "held" };
    }
    return { status: begun.why };
  }
  const userId = begun.userId;

  /** One call to Meta inside a step: a busy Meta retries the step, anything else is decided here. */
  async function meta<T>(name: string, fn: (c: InstagramClient, pub: Publisher, p: PostRecord) => Promise<T>) {
    return steps.run(name, async () => {
      const p = await deps.posts.byId(req.postId);
      if (!mine(p) || p.status !== "publishing") return { ok: false as const, why: "skipped" as const };
      const c = deps.client();
      const pub = await deps.publisher(userId);
      if (!c) return { ok: false as const, why: "final" as const, error: UNAVAILABLE };
      if (!pub.ok) return { ok: false as const, why: "reconnect" as const };
      try {
        return { ok: true as const, value: await fn(c, pub.publisher, p) };
      } catch (err) {
        const k = classify(err);
        console.error(`[post] ${name} failed`, req.postId, err instanceof MetaError ? `${err.status} ${err.code}/${err.subcode} ${err.message}` : err);
        if (k.kind === "transient") throw new Transient(err instanceof Error ? err.message : String(err));
        if (k.kind === "reconnect") return { ok: false as const, why: "reconnect" as const };
        return { ok: false as const, why: "final" as const, error: k.error };
      }
    });
  }
  type Stop = { ok: false; why: "skipped" | "reconnect" | "final"; error?: PostError };
  async function stop(r: Stop): Promise<Outcome> {
    if (r.why === "skipped") return { status: "skipped" };
    if (r.why === "reconnect") {
      await reconnect(userId);
      return { status: "held" };
    }
    await fail(r.error ?? UNAVAILABLE);
    return { status: "failed" };
  }

  // 3. Hand Meta the video (once: a retried step finds the container it made).
  const upload = await meta("upload", async (c, pub, p) => {
    if (p.containerId) return p.containerId;
    const r = await deps.renders.get(p.userId, p.renderId);
    if (!r?.videoKey || r.status !== "ready") throw new Error("render has no video");
    const videoUrl = await deps.storage().signedUrl(r.videoKey, VIDEO_LINK_SEC);
    const id = await c.createReel(pub.token, pub.igUserId, {
      videoUrl,
      caption: fullCaption(p.caption, p.hashtags),
      thumbOffsetMs: p.coverOffsetMs,
    });
    await deps.posts.update(p.id, { containerId: id, updatedAt: now() }, ["publishing"]);
    return id;
  });
  if (!upload.ok) return stop(upload);
  const containerId = upload.value;

  // 4. Wait while Meta processes it.
  let processed: "FINISHED" | "PUBLISHED" | null = null;
  for (let i = 1; i <= PROCESS_MAX_POLLS && !processed; i++) {
    await steps.sleep(`processing-${i}`, pollMs);
    const s = await meta(`check-${i}`, (c, pub) => c.containerStatus(pub.token, containerId));
    if (!s.ok) return stop(s);
    if (s.value.status === "FINISHED" || s.value.status === "PUBLISHED") processed = s.value.status;
    else if (s.value.status === "ERROR" || s.value.status === "EXPIRED") {
      return stop({
        ok: false,
        why: "final",
        error: {
          code: "IG_REJECTED",
          message: `Instagram couldn't process the video${s.value.message ? `: ${s.value.message}` : "."}`.slice(0, 300),
        },
      });
    }
  }
  if (!processed) {
    return stop({ ok: false, why: "final", error: { code: "IG_UNAVAILABLE", message: "Instagram took too long to process the video. Try again." } });
  }

  // 5. Publish (skipped when a retried step finds it already went out).
  const published = await meta("publish", async (c, pub, p) => {
    if (p.mediaId) return p.mediaId;
    if (processed === "PUBLISHED") return null;
    // A try before this one may have published and then failed (timeout, 5xx, crash) before
    // saving the media id. Publishing again would fail and mark a live Reel as failed.
    if ((await c.containerStatus(pub.token, containerId)).status === "PUBLISHED") return null;
    const id = await c.publish(pub.token, pub.igUserId, containerId);
    await deps.posts.update(p.id, { mediaId: id, updatedAt: now() }, ["publishing"]);
    return id;
  });
  if (!published.ok) return stop(published);

  // 6. Save the link to the Reel.
  await steps.run("finish", async () => {
    const p = await deps.posts.byId(req.postId);
    if (!mine(p)) return;
    const mediaId = published.value;
    let permalink: string | null = null;
    const c = deps.client();
    const pub = await deps.publisher(userId);
    if (mediaId && c && pub.ok) permalink = await c.permalink(pub.publisher.token, mediaId).catch(() => null);
    const t = now();
    const done = await deps.posts.update(p.id, { status: "posted", permalink, error: null, postedAt: t, updatedAt: t }, ["publishing"]);
    if (done) await deps.projects.setRenderState(p.userId, p.projectId, { status: "posted", step: "post" }, t);
  });
  return { status: "posted" };
}

/** Runs the job in this process (local tests): steps run once, sleeps really sleep. */
export function inlinePostSteps(): PostSteps {
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, Math.min(ms, 2 ** 31 - 1))));
  return {
    run: (_name, fn) => fn(),
    sleep: (_name, ms) => wait(ms),
    sleepUntil: (_name, at) => wait(at.getTime() - Date.now()),
  };
}

export { Transient };
