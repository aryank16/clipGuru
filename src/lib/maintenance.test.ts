import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DB_DRIVER = "memory";
process.env.AI_DRIVER = "fake";

let m: typeof import("./maintenance");
let projects: typeof import("./projects/memory");
let projectSvc: typeof import("./projects/service");
let renders: typeof import("./render/repo");
let renderSvcMod: typeof import("./render/service");
let posts: typeof import("./posts/repo");
let postSvcMod: typeof import("./posts/service");
let chat: typeof import("./chat/repo");
let sb: typeof import("./storyboard/repo");
let vo: typeof import("./voiceover/repo");
let storage: typeof import("./storage");
let ig: typeof import("./instagram/repo");
let igClient: typeof import("./instagram/client");

beforeAll(async () => {
  m = await import("./maintenance");
  projects = await import("./projects/memory");
  projectSvc = await import("./projects/service");
  renders = await import("./render/repo");
  renderSvcMod = await import("./render/service");
  posts = await import("./posts/repo");
  postSvcMod = await import("./posts/service");
  chat = await import("./chat/repo");
  sb = await import("./storyboard/repo");
  vo = await import("./voiceover/repo");
  storage = await import("./storage");
  ig = await import("./instagram/repo");
  igClient = await import("./instagram/client");
});

beforeEach(() => {
  projects.resetMemoryProjects();
  renders.resetMemoryRenders();
  posts.resetMemoryPosts();
  chat.resetMemoryChat();
  sb.resetMemoryStoryboards();
  vo.resetMemoryVoiceovers();
  storage.resetMemoryStorage();
  ig.resetMemoryInstagram();
});

const DAY = 24 * 3600_000;
const A = "user-a";

function renderRecord(userId: string, projectId: string, over: Partial<import("./render/types").RenderRecord> = {}) {
  const t = new Date();
  return {
    id: renders.memoryRenders.newId(),
    userId,
    projectId,
    version: 1,
    voiceId: "v",
    voiceoverId: null,
    status: "ready" as const,
    stage: "finish" as const,
    progress: 1,
    durationSec: 30,
    videoKey: null,
    thumbKey: null,
    covers: [],
    coverIndex: 0,
    sandboxId: null,
    cmdId: null,
    error: null,
    attempts: 1,
    createdAt: t,
    updatedAt: t,
    startedAt: t,
    finishedAt: t,
    ...over,
  };
}

/** A video with a render and a file, deleted `daysAgo` days ago (or live when null). */
async function video(daysAgo: number | null) {
  const p = await projectSvc.projectService(projects.memoryProjects).create(A);
  await renders.memoryRenders.insert(renderRecord(A, p.id));
  await storage.memoryStorage.put(`${m.projectPrefix(A, p.id)}renders/r/video.mp4`, new Uint8Array([1]), "video/mp4");
  if (daysAgo !== null) {
    const at = new Date(Date.now() - daysAgo * DAY);
    await projects.memoryProjects.setDeleted(A, p.id, at, at);
  }
  return p.id;
}

function purgeDeps() {
  return {
    projects: projects.memoryProjects,
    posts: posts.memoryPosts,
    chat: chat.memoryChat,
    storyboards: sb.memoryStoryboards,
    voiceovers: vo.memoryVoiceovers,
    renders: renders.memoryRenders,
    storage: storage.memoryStorage,
  };
}

describe("purgeDeletedProjects", () => {
  it("removes only videos past the 30-day restore window, with their renders and files", async () => {
    const old = await video(31);
    const recent = await video(5);
    const live = await video(null);

    expect(await m.purgeDeletedProjects(purgeDeps())).toBe(1);

    expect(await projects.memoryProjects.getDeleted(A, old)).toBeNull();
    expect(await renders.memoryRenders.latestForProject(A, old)).toBeNull();
    expect(await storage.memoryStorage.read!(`${m.projectPrefix(A, old)}renders/r/video.mp4`)).toBeNull();

    // Still restorable, and untouched.
    expect(await projects.memoryProjects.getDeleted(A, recent)).not.toBeNull();
    expect(await renders.memoryRenders.latestForProject(A, recent)).not.toBeNull();
    expect(await storage.memoryStorage.read!(`${m.projectPrefix(A, recent)}renders/r/video.mp4`)).not.toBeNull();
    expect(await projects.memoryProjects.get(A, live)).not.toBeNull();

    // Nothing left to do on the next run.
    expect(await m.purgeDeletedProjects(purgeDeps())).toBe(0);
  });

  it("keeps the video record when its files can't be removed, so tomorrow's run retries", async () => {
    const old = await video(40);
    const failing = { ...storage.memoryStorage, deletePrefix: async () => Promise.reject(new Error("R2 down")) };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await m.purgeDeletedProjects({ ...purgeDeps(), storage: failing })).toBe(0);
    spy.mockRestore();
    expect(await projects.memoryProjects.getDeleted(A, old)).not.toBeNull();
    expect(await renders.memoryRenders.latestForProject(A, old)).not.toBeNull();
  });
});

describe("watchdog sweeps", () => {
  it("fails a render stuck running even when nobody opens the video", async () => {
    const p = await projectSvc.projectService(projects.memoryProjects).create(A);
    const long = new Date(Date.now() - 2 * 3600_000);
    const stuck = renderRecord(A, p.id, { status: "running", stage: "render", updatedAt: long, finishedAt: null });
    await renders.memoryRenders.insert(stuck);
    const fresh = renderRecord(A, (await projectSvc.projectService(projects.memoryProjects).create(A)).id, {
      status: "running",
      stage: "render",
      finishedAt: null,
    });
    await renders.memoryRenders.insert(fresh);
    const svc = renderSvcMod.renderService({
      renders: renders.memoryRenders,
      projects: projects.memoryProjects,
    } as unknown as Parameters<typeof renderSvcMod.renderService>[0]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await svc.sweep()).toBe(1);
    spy.mockRestore();
    expect((await renders.memoryRenders.byId(stuck.id))?.status).toBe("failed");
    expect((await renders.memoryRenders.byId(fresh.id))?.status).toBe("running");
  });

  it("fails a scheduled post whose time passed long ago without going out", async () => {
    const p = await projectSvc.projectService(projects.memoryProjects).create(A);
    const t = new Date();
    const base = {
      userId: A,
      projectId: p.id,
      renderId: "r",
      caption: "c",
      hashtags: [],
      coverOffsetMs: 0,
      mode: "scheduled" as const,
      igUserId: null,
      igUsername: null,
      timeZone: "UTC",
      containerId: null,
      mediaId: null,
      permalink: null,
      error: null,
      idempotencyKey: null,
      runToken: "t",
      attempts: 0,
      createdAt: t,
      updatedAt: t,
      postedAt: null,
    };
    const lost = { ...base, id: posts.memoryPosts.newId(), status: "scheduled" as const, scheduledAt: new Date(Date.now() - 3600_000) };
    await posts.memoryPosts.insert(lost as never);
    const svc = postSvcMod.postService({
      posts: posts.memoryPosts,
      projects: projects.memoryProjects,
      renders: renders.memoryRenders,
      storyboards: sb.memoryStoryboards,
      publisher: async () => ({ ok: false, reason: "not_connected" }),
      dispatch: async () => {},
      cancelRun: async () => {},
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await svc.sweep()).toBe(1);
    spy.mockRestore();
    expect((await posts.memoryPosts.byId(lost.id))?.status).toBe("failed");
  });
});

describe("checkInstagramConnections", () => {
  async function link(userId: string, over: Partial<import("./instagram/types").InstagramAccountRecord> = {}) {
    const t = new Date();
    await ig.memoryInstagram.save({
      userId,
      igUserId: `ig-${userId}`,
      username: userId,
      avatarUrl: null,
      tokenEnc: `tok-${userId}`,
      tokenExpiresAt: null,
      clientBusinessId: null,
      reconnectNeeded: false,
      connectedAt: t,
      updatedAt: t,
      ...over,
    });
  }

  it("flags revoked, expired and removed connections, and leaves working ones and Meta outages alone", async () => {
    await link("ok");
    await link("revoked");
    await link("expired", { tokenExpiresAt: new Date(Date.now() - 1000) });
    await link("removed");
    await link("busy");
    const client = {
      async accounts(token: string) {
        if (token === "tok-revoked") throw new igClient.MetaError("Session has expired", 400, 190);
        if (token === "tok-busy") throw new igClient.MetaError("Service unavailable", 503, 2);
        if (token === "tok-removed") return { clientBusinessId: null, accounts: [] };
        return { clientBusinessId: null, accounts: [{ id: `ig-${token.slice(4)}`, username: "x", avatarUrl: null }] };
      },
    } as unknown as import("./instagram/client").InstagramClient;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await m.checkInstagramConnections({ instagram: ig.memoryInstagram, client, open: (s) => s })).toBe(3);
    err.mockRestore();
    warn.mockRestore();
    const flagged = async (u: string) => (await ig.memoryInstagram.get(u))?.reconnectNeeded;
    expect(await flagged("ok")).toBe(false);
    expect(await flagged("busy")).toBe(false);
    expect(await flagged("revoked")).toBe(true);
    expect(await flagged("expired")).toBe(true);
    expect(await flagged("removed")).toBe(true);
  });

  it("does nothing when Instagram isn't set up", async () => {
    await link("a");
    expect(await m.checkInstagramConnections({ instagram: ig.memoryInstagram, client: null, open: (s) => s })).toBe(0);
  });
});
