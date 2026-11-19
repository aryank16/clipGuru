import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DB_DRIVER = "memory";
process.env.AI_DRIVER = "fake";

let types: typeof import("./types");
let job: typeof import("./job");
let svcMod: typeof import("./service");
let repo: typeof import("./repo");
let projects: typeof import("../projects/memory");
let projectSvc: typeof import("../projects/service");
let renders: typeof import("../render/repo");
let sbRepo: typeof import("../storyboard/repo");
let storage: typeof import("../storage");
let ig: typeof import("../instagram/client");
let zoned: typeof import("../zoned");

beforeAll(async () => {
  types = await import("./types");
  job = await import("./job");
  svcMod = await import("./service");
  repo = await import("./repo");
  projects = await import("../projects/memory");
  projectSvc = await import("../projects/service");
  renders = await import("../render/repo");
  sbRepo = await import("../storyboard/repo");
  storage = await import("../storage");
  ig = await import("../instagram/client");
  zoned = await import("../zoned");
});

beforeEach(() => {
  projects.resetMemoryProjects();
  renders.resetMemoryRenders();
  sbRepo.resetMemoryStoryboards();
  repo.resetMemoryPosts();
  storage.resetMemoryStorage();
});

const A = "user-a";
const B = "user-b";
const PUB = { ok: true as const, publisher: { igUserId: "ig-1", username: "clipguru.test", token: "tok" } };
type PubResult = Awaited<ReturnType<import("./job").PublishDeps["publisher"]>>;

/** A video with a ready render that is its latest. */
async function readyVideo(user = A) {
  const p = await projectSvc.projectService(projects.memoryProjects).create(user);
  const t = new Date();
  const id = renders.memoryRenders.newId();
  await renders.memoryRenders.insert({
    id,
    userId: user,
    projectId: p.id,
    version: 1,
    voiceId: "v",
    voiceoverId: null,
    status: "ready",
    stage: "finish",
    progress: 1,
    durationSec: 42,
    videoKey: `users/${user}/v.mp4`,
    thumbKey: null,
    covers: [
      { key: "c0", frame: 0, offsetMs: 1000 },
      { key: "c1", frame: 1, offsetMs: 9000 },
    ],
    coverIndex: 1,
    sandboxId: null,
    cmdId: null,
    error: null,
    attempts: 1,
    createdAt: t,
    updatedAt: t,
    startedAt: t,
    finishedAt: t,
  });
  await projects.memoryProjects.setRenderState(user, p.id, { status: "ready", step: "generate", latestRenderId: id }, t);
  return { projectId: p.id, renderId: id };
}

function service(o: { publisher?: PubResult; now?: () => Date; sent?: string[]; cancelled?: string[] } = {}) {
  return svcMod.postService({
    posts: repo.memoryPosts,
    projects: projects.memoryProjects,
    renders: renders.memoryRenders,
    storyboards: sbRepo.memoryStoryboards,
    publisher: async () => o.publisher ?? PUB,
    dispatch: async (p) => {
      o.sent?.push(p.id);
    },
    cancelRun: async (p) => {
      o.cancelled?.push(p.id);
    },
    now: o.now,
  });
}

function deps(over: Partial<import("./job").PublishDeps> = {}): import("./job").PublishDeps {
  return {
    posts: repo.memoryPosts,
    projects: projects.memoryProjects,
    renders: renders.memoryRenders,
    storage: () => storage.memoryStorage,
    client: () => ig.fakeClient(),
    publisher: async () => PUB,
    markReconnectNeeded: async () => {},
    pollMs: 1,
    ...over,
  };
}

/** Runs each step once, like Inngest; sleeps are recorded, not waited. */
function steps() {
  const names: string[] = [];
  const waits: Date[] = [];
  const s: import("./job").PostSteps = {
    run: (name, fn) => {
      names.push(name);
      return fn();
    },
    sleep: async (name) => {
      names.push(name);
    },
    sleepUntil: async (name, at) => {
      names.push(name);
      waits.push(at);
    },
  };
  return { s, names, waits };
}

const body = (renderId: string, over: Partial<import("./service").CreatePostBody> = {}): import("./service").CreatePostBody => ({
  renderId,
  caption: "Why the sky is blue",
  hashtags: ["science"],
  mode: "now",
  ...over,
});

describe("caption text", () => {
  it("cleans and dedupes hashtags", () => {
    expect(types.parseHashtags("#Science, science #water-cycle  ##fun!")).toEqual(["Science", "watercycle", "fun"]);
  });
  it("counts hashtags typed into the caption too, and joins the full text", () => {
    const text = types.fullCaption("Light #bends here", ["science", "physics"]);
    expect(text).toBe("Light #bends here\n\n#science #physics");
    expect(types.countHashtags(text)).toBe(3);
    expect(types.fullCaption("", ["a"])).toBe("#a");
  });
});

describe("zoned time", () => {
  it("converts wall time in a zone to UTC and back", () => {
    expect(zoned.zonedToUtc("2026-11-20", "18:30", "Europe/Berlin").toISOString()).toBe("2026-11-20T17:30:00.000Z");
    expect(zoned.zonedToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zoned.zonedToUtc("2026-11-20", "18:30", "Asia/Kolkata").toISOString()).toBe("2026-11-20T13:00:00.000Z");
    expect(zoned.utcToZoned(new Date("2026-11-20T17:30:00Z"), "Europe/Berlin")).toEqual({ date: "2026-11-20", time: "18:30" });
  });
  it("moves a time skipped by a clock change forward", () => {
    // 02:30 doesn't exist in Berlin on 29 March 2026; it becomes 03:30 CEST.
    expect(zoned.zonedToUtc("2026-03-29", "02:30", "Europe/Berlin").toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });
  it("formats with the year only when it isn't this year", () => {
    const now = new Date("2026-11-19T12:00:00Z");
    expect(zoned.formatInZone(new Date("2026-11-20T17:30:00Z"), "Europe/Berlin", now)).toBe("Fri 20 Nov, 18:30");
    expect(zoned.formatInZone(new Date("2027-01-05T09:00:00Z"), "Europe/London", now)).toBe("Tue 5 Jan 2027, 09:00");
  });
});

describe("post service", () => {
  it("posts now: starts the job, uses the chosen cover, and moves the video to step 4", async () => {
    const v = await readyVideo();
    const sent: string[] = [];
    const { post, created } = await service({ sent }).create(A, v.projectId, body(v.renderId), "key-12345678");
    expect(created).toBe(true);
    expect(post).toMatchObject({ status: "publishing", mode: "now", coverOffsetMs: 9000, igUsername: "clipguru.test", hashtags: ["science"] });
    expect(sent).toEqual([post.id]);
    expect(await projects.memoryProjects.get(A, v.projectId)).toMatchObject({ step: "post" });

    // The same key returns the same post and starts nothing new.
    const again = await service({ sent }).create(A, v.projectId, body(v.renderId), "key-12345678");
    expect(again).toMatchObject({ created: false, post: { id: post.id } });
    expect(sent).toHaveLength(1);
  });

  it("checks the schedule window and suggests the nearest time", async () => {
    const v = await readyVideo();
    const t = new Date("2026-11-19T12:00:00Z");
    const svc = service({ now: () => t });
    await expect(
      svc.create(A, v.projectId, body(v.renderId, { mode: "scheduled", scheduledAt: "2026-11-19T12:05:00Z" }), null),
    ).rejects.toMatchObject({ code: "SCHEDULE_OUT_OF_RANGE", details: { nearestValid: "2026-11-19T12:15:00.000Z" } });
    await expect(
      svc.create(A, v.projectId, body(v.renderId, { mode: "scheduled", scheduledAt: "2027-02-01T12:00:00Z" }), null),
    ).rejects.toMatchObject({ code: "SCHEDULE_OUT_OF_RANGE" });

    const { post } = await svc.create(A, v.projectId, body(v.renderId, { mode: "scheduled", scheduledAt: "2026-11-20T17:30:00Z", timeZone: "Europe/Berlin" }), null);
    expect(post).toMatchObject({ status: "scheduled", scheduledAt: "2026-11-20T17:30:00.000Z", editableUntil: "2026-11-20T17:25:00.000Z" });
    expect(await projects.memoryProjects.get(A, v.projectId)).toMatchObject({ status: "scheduled", step: "post" });

    // One waiting post per video.
    await expect(svc.create(A, v.projectId, body(v.renderId), null)).rejects.toMatchObject({ code: "ALREADY_POSTED", details: { status: "scheduled" } });
  });

  it("enforces Instagram's caption and hashtag limits", async () => {
    const v = await readyVideo();
    await expect(service().create(A, v.projectId, body(v.renderId, { caption: "x".repeat(2200) }), null)).rejects.toMatchObject({
      code: "CAPTION_TOO_LONG",
    });
    const many = Array.from({ length: 31 }, (_, i) => `tag${i}`);
    await expect(service().create(A, v.projectId, body(v.renderId, { hashtags: many }), null)).rejects.toMatchObject({ code: "TOO_MANY_HASHTAGS" });
  });

  it("needs a connected Instagram, the latest render, and the owner", async () => {
    const v = await readyVideo();
    await expect(service({ publisher: { ok: false, reason: "not_connected" } }).create(A, v.projectId, body(v.renderId), null)).rejects.toMatchObject({
      code: "INSTAGRAM_NOT_CONNECTED",
    });
    await expect(service({ publisher: { ok: false, reason: "reconnect_needed" } }).create(A, v.projectId, body(v.renderId), null)).rejects.toMatchObject({
      code: "INSTAGRAM_RECONNECT_NEEDED",
    });
    await projects.memoryProjects.setRenderState(A, v.projectId, { latestRenderId: "newer" }, new Date());
    await expect(service().create(A, v.projectId, body(v.renderId), null)).rejects.toMatchObject({ code: "RENDER_NOT_LATEST" });
    await expect(service().create(B, v.projectId, body(v.renderId), null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service().latest(B, v.projectId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("asks before posting the same video twice", async () => {
    const v = await readyVideo();
    const { post } = await service().create(A, v.projectId, body(v.renderId), null);
    await repo.memoryPosts.update(post.id, { status: "posted", permalink: "https://www.instagram.com/reel/x/", postedAt: new Date() });
    await expect(service().create(A, v.projectId, body(v.renderId), null)).rejects.toMatchObject({ code: "ALREADY_POSTED", details: { status: "posted" } });
    await expect(service().create(A, v.projectId, body(v.renderId, { confirmRepost: true }), null)).resolves.toMatchObject({ created: true });
  });

  it("cancels a scheduled post until 5 minutes before", async () => {
    const v = await readyVideo();
    let t = new Date("2026-11-19T12:00:00Z");
    const cancelled: string[] = [];
    const svc = service({ now: () => t, cancelled });
    const { post } = await svc.create(A, v.projectId, body(v.renderId, { mode: "scheduled", scheduledAt: "2026-11-19T13:00:00Z" }), null);

    t = new Date("2026-11-19T12:56:00Z");
    await expect(svc.cancel(A, post.id)).rejects.toMatchObject({ code: "POST_LOCKED" });
    t = new Date("2026-11-19T12:30:00Z");
    await expect(svc.cancel(A, post.id)).resolves.toMatchObject({ status: "cancelled" });
    expect(cancelled).toEqual([post.id]);
    expect(await projects.memoryProjects.get(A, v.projectId)).toMatchObject({ status: "ready" });
  });

  it("holds scheduled posts on disconnect, and retries them with a new run", async () => {
    const v = await readyVideo();
    const sent: string[] = [];
    const svc = service({ sent });
    const { post } = await svc.create(
      A,
      v.projectId,
      body(v.renderId, { mode: "scheduled", scheduledAt: new Date(Date.now() + 3600_000).toISOString() }),
      null,
    );
    const before = (await repo.memoryPosts.byId(post.id))!.runToken;
    expect(await svc.holdAll(A)).toBe(1);
    expect(await svc.get(A, post.id)).toMatchObject({ status: "held", error: { code: "IG_RECONNECT" } });
    expect(await projects.memoryProjects.get(A, v.projectId)).toMatchObject({ status: "attention" });

    await expect(svc.retry(A, post.id, { mode: "now" })).resolves.toMatchObject({ status: "publishing", error: null });
    expect((await repo.memoryPosts.byId(post.id))!.runToken).not.toBe(before);
    expect(sent).toEqual([post.id, post.id]);
    await expect(svc.retry(A, post.id, { mode: "now" })).rejects.toMatchObject({ code: "NOT_RETRYABLE" });
  });
});

describe("publishing job", () => {
  async function started(caption = "Why the sky is blue", over: Partial<import("./service").CreatePostBody> = {}) {
    const v = await readyVideo();
    const { post } = await service().create(A, v.projectId, body(v.renderId, { caption, ...over }), null);
    const rec = (await repo.memoryPosts.byId(post.id))!;
    return { v, post, req: { postId: rec.id, userId: A, runToken: rec.runToken } };
  }

  it("uploads, waits for processing, publishes and saves the link", async () => {
    const { v, req } = await started();
    const { s, names } = steps();
    await expect(job.publishJob(s, req, deps())).resolves.toEqual({ status: "posted" });
    const p = (await repo.memoryPosts.byId(req.postId))!;
    expect(p).toMatchObject({ status: "posted", error: null });
    expect(p.permalink).toMatch(/^https:\/\/www\.instagram\.com\/reel\//);
    expect(names.slice(0, 3)).toEqual(["load", "begin", "upload"]);
    expect(names).toContain("publish");
    expect(await projects.memoryProjects.get(A, v.projectId)).toMatchObject({ status: "posted", step: "post" });
  });

  it("waits for a far-off time in hops under 7 days", async () => {
    const t0 = new Date("2026-11-19T12:00:00Z");
    const v = await readyVideo();
    const { post } = await service({ now: () => t0 }).create(
      A,
      v.projectId,
      body(v.renderId, { mode: "scheduled", scheduledAt: "2026-12-02T12:00:00Z" }),
      null,
    );
    const rec = (await repo.memoryPosts.byId(post.id))!;
    const { s, waits } = steps();
    await job.publishJob(s, { postId: rec.id, userId: A, runToken: rec.runToken }, deps({ now: () => t0 }));
    expect(waits.map((w) => w.toISOString())).toEqual(["2026-11-25T12:00:00.000Z", "2026-12-01T12:00:00.000Z", "2026-12-02T12:00:00.000Z"]);
  });

  it("does nothing for an old run after the post was restarted or cancelled", async () => {
    const { req } = await started();
    const { s } = steps();
    await expect(job.publishJob(s, { ...req, runToken: "old" }, deps())).resolves.toEqual({ status: "skipped" });
    expect((await repo.memoryPosts.byId(req.postId))!.status).toBe("publishing");
  });

  it("marks a rejected video as failed", async () => {
    const { req } = await started("FAKE_REJECT this");
    const { s } = steps();
    await expect(job.publishJob(s, req, deps())).resolves.toEqual({ status: "failed" });
    expect(await repo.memoryPosts.byId(req.postId)).toMatchObject({ status: "failed", error: { code: "IG_REJECTED" } });
  });

  it("reports the daily limit", async () => {
    const { req } = await started("FAKE_LIMIT");
    const { s } = steps();
    await job.publishJob(s, req, deps());
    expect(await repo.memoryPosts.byId(req.postId)).toMatchObject({ status: "failed", error: { code: "IG_DAILY_LIMIT" } });
  });

  it("holds the post and flags the account when the token stops working", async () => {
    const { req } = await started("FAKE_TOKEN");
    const flagged: string[] = [];
    const { s } = steps();
    await expect(job.publishJob(s, req, deps({ markReconnectNeeded: async (u) => void flagged.push(u) }))).resolves.toEqual({ status: "held" });
    expect(flagged).toEqual([A]);
    expect(await repo.memoryPosts.byId(req.postId)).toMatchObject({ status: "held", error: { code: "IG_RECONNECT" } });
  });

  it("classifies Meta errors", () => {
    expect(job.classify(new ig.MetaError("busy", 503, 2))).toEqual({ kind: "transient" });
    expect(job.classify(new ig.MetaError("token", 400, 190))).toEqual({ kind: "reconnect" });
    expect(job.classify(new ig.MetaError("perm", 403, 200))).toEqual({ kind: "reconnect" });
    expect(job.classify(new ig.MetaError("bad", 400, 100))).toMatchObject({ kind: "final", error: { code: "IG_REJECTED" } });
    expect(job.classify(new Error("network"))).toEqual({ kind: "transient" });
  });
});
