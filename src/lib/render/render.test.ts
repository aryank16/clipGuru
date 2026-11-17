import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DB_DRIVER = "memory";
process.env.AI_DRIVER = "fake";

let job: typeof import("./job");
let svcMod: typeof import("./service");
let repo: typeof import("./repo");
let rendererMod: typeof import("./renderer");
let storage: typeof import("../storage");
let sbRepo: typeof import("../storyboard/repo");
let sbSvc: typeof import("../storyboard/service");
let writer: typeof import("../storyboard/writer");
let projects: typeof import("../projects/memory");
let projectSvc: typeof import("../projects/service");
let voSvc: typeof import("../voiceover/service");
let voRepo: typeof import("../voiceover/repo");
let tts: typeof import("../voiceover/tts");
let errors: typeof import("../api/errors");

beforeAll(async () => {
  job = await import("./job");
  svcMod = await import("./service");
  repo = await import("./repo");
  rendererMod = await import("./renderer");
  storage = await import("../storage");
  sbRepo = await import("../storyboard/repo");
  sbSvc = await import("../storyboard/service");
  writer = await import("../storyboard/writer");
  projects = await import("../projects/memory");
  projectSvc = await import("../projects/service");
  voSvc = await import("../voiceover/service");
  voRepo = await import("../voiceover/repo");
  tts = await import("../voiceover/tts");
  errors = await import("../api/errors");
});

beforeEach(() => {
  projects.resetMemoryProjects();
  sbRepo.resetMemoryStoryboards();
  voRepo.resetMemoryVoiceovers();
  repo.resetMemoryRenders();
  storage.resetMemoryStorage();
});

const A = "user-a";
const B = "user-b";

const voices = () =>
  voSvc.voiceoverService({
    projects: projects.memoryProjects,
    storyboards: sbRepo.memoryStoryboards,
    voiceovers: voRepo.memoryVoiceovers,
    storage: () => storage.memoryStorage,
    tts: () => tts.fakeTts,
  });

function deps(over: Partial<import("./job").JobDeps> = {}): import("./job").JobDeps {
  return {
    renders: repo.memoryRenders,
    projects: projects.memoryProjects,
    storyboards: sbRepo.memoryStoryboards,
    recordVoice: async (u, p, v) => (await voices().create(u, p, v)).voiceover,
    voiceoverRecord: (u, id) => voRepo.memoryVoiceovers.get(u, id),
    storage: () => storage.memoryStorage,
    renderer: () => rendererMod.fakeRenderer(60),
    pollMs: 20,
    ...over,
  };
}

/** Records every step name, and runs it once like Inngest would. */
function steps() {
  const names: string[] = [];
  const s: import("./job").Steps = {
    run: (name, fn) => {
      names.push(name);
      return fn();
    },
    sleep: (_n, ms) => new Promise((r) => setTimeout(r, ms)),
  };
  return { s, names };
}

function service(dispatched: string[] = []) {
  return svcMod.renderService({
    renders: repo.memoryRenders,
    projects: projects.memoryProjects,
    storyboards: sbRepo.memoryStoryboards,
    dispatch: async (r) => {
      dispatched.push(r.id);
    },
  });
}

async function projectWithStoryboard(user = A, narration?: string) {
  const ps = projectSvc.projectService(projects.memoryProjects);
  const p = await ps.create(user);
  const brief = { title: "How rainbows form", audience: "", keyPoints: ["Light bends"], angle: "", tone: "", targetSeconds: 75, length: "auto" as const };
  const withBrief = await ps.patch(user, p.id, { rev: 0, brief });
  const sbs = sbSvc.storyboardService({ projects: projects.memoryProjects, storyboards: sbRepo.memoryStoryboards, writer: writer.geminiWriter });
  const saved = await sbs.generate(user, p.id, withBrief.rev);
  if (!narration) return saved.project;
  const sb = structuredClone(saved.version.storyboard);
  sb.scenes[1].narration = narration;
  return (await sbs.save(user, p.id, { rev: saved.rev, baseVersion: 1, storyboard: sb })).project;
}

describe("render service", () => {
  it("queues a render of the current version and marks the video as generating", async () => {
    const p = await projectWithStoryboard();
    const sent: string[] = [];
    const r = await service(sent).create(A, p.id);
    expect(r).toMatchObject({ status: "queued", version: 1, stage: "voice", progress: 0, videoUrl: null });
    expect(sent).toEqual([r.id]);
    const after = await projects.memoryProjects.get(A, p.id);
    expect(after).toMatchObject({ status: "generating", step: "generate", latestRenderId: r.id, rev: p.rev });
  });

  it("allows one render per video, 3 running per person and 10 a day", async () => {
    const p = await projectWithStoryboard();
    const first = await service().create(A, p.id);
    await expect(service().create(A, p.id)).rejects.toMatchObject({ code: "RENDER_RUNNING", details: { renderId: first.id } });

    const more = [await projectWithStoryboard(), await projectWithStoryboard(), await projectWithStoryboard()];
    await service().create(A, more[0].id);
    await service().create(A, more[1].id);
    await expect(service().create(A, more[2].id)).rejects.toMatchObject({ code: "LIMIT_REACHED", details: { limit: "renders_running" } });

    // Another person's limits are their own, and they can't see A's render.
    const other = await projectWithStoryboard(B);
    await expect(service().create(B, other.id)).resolves.toMatchObject({ status: "queued" });
    await expect(service().get(B, first.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service().create(B, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  }, 30_000);

  it("stops at 10 renders a day", async () => {
    const p = await projectWithStoryboard();
    const t = new Date();
    for (let i = 0; i < 10; i++) {
      const r = await service().create(A, p.id);
      await repo.memoryRenders.update(r.id, { status: "ready" });
    }
    expect(await repo.memoryRenders.countSince(A, new Date(t.getTime() - 1000))).toBe(10);
    await expect(service().create(A, p.id)).rejects.toMatchObject({ code: "LIMIT_REACHED", details: { limit: "renders_per_day" } });
  });

  it("fails the render at once when the job can't be started", async () => {
    const p = await projectWithStoryboard();
    const svc = svcMod.renderService({
      renders: repo.memoryRenders,
      projects: projects.memoryProjects,
      storyboards: sbRepo.memoryStoryboards,
      dispatch: async () => {
        throw new Error("inngest down");
      },
    });
    await expect(svc.create(A, p.id)).rejects.toBeInstanceOf(errors.ApiError);
    const r = await repo.memoryRenders.latestForProject(A, p.id);
    expect(r).toMatchObject({ status: "failed", error: { code: "RENDER_FAILED" } });
    expect((await projects.memoryProjects.get(A, p.id))?.status).toBe("attention");
  });
});

describe("render job", () => {
  it("records the voice, renders, saves the video and thumbnail, and marks the video ready", async () => {
    const p = await projectWithStoryboard();
    const r = await service().create(A, p.id);
    const { s, names } = steps();
    const stop = vi.fn();
    const fake = rendererMod.fakeRenderer(60);
    await expect(job.renderJob(s, r.id, deps({ renderer: () => ({ ...fake, stop: async (id) => { stop(id); return fake.stop(id); } }) }))).resolves.toEqual({ status: "ready" });

    expect(names.slice(0, 4)).toEqual(["begin", "voice", "setup", "start-render"]);
    expect(names).toContain("poll-0");
    expect(names.at(-1)).toBe("save");
    const done = await repo.memoryRenders.byId(r.id);
    expect(done).toMatchObject({ status: "ready", progress: 1, stage: "finish", sandboxId: null, error: null });
    expect(done?.videoKey).toBe(`users/${A}/projects/${p.id}/renders/${r.id}/video.mp4`);
    expect((await storage.memoryStorage.read!(done!.videoKey!))?.contentType).toBe("video/mp4");
    expect((await storage.memoryStorage.read!(done!.thumbKey!))?.contentType).toBe("image/jpeg");
    expect(done?.voiceoverId).toBeTruthy();
    expect(done?.durationSec).toBeGreaterThan(10);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(await projects.memoryProjects.get(A, p.id)).toMatchObject({ status: "ready", latestRenderId: r.id, rev: p.rev });

    const shown = await service().get(A, r.id);
    expect(shown).toMatchObject({ videoUrl: `/api/renders/${r.id}/video`, thumbnailUrl: `/api/renders/${r.id}/thumbnail` });
  });

  it("does nothing for a render that isn't queued (a duplicate event)", async () => {
    const p = await projectWithStoryboard();
    const r = await service().create(A, p.id);
    await job.renderJob(steps().s, r.id, deps());
    const { s, names } = steps();
    await expect(job.renderJob(s, r.id, deps())).resolves.toEqual({ status: "skipped" });
    expect(names).toEqual(["begin"]);
  });

  it("marks a broken render failed, frees the machine, and a retry reuses the voice", async () => {
    const p = await projectWithStoryboard(A, "This part says renderfail so the fake renderer breaks halfway through.");
    const r = await service().create(A, p.id);
    const synth = vi.spyOn(tts.fakeTts, "synthesize");
    await expect(job.renderJob(steps().s, r.id, deps())).resolves.toEqual({ status: "failed" });
    const failed = await repo.memoryRenders.byId(r.id);
    expect(failed).toMatchObject({ status: "failed", sandboxId: null, error: { code: "RENDER_FAILED", stage: "render" } });
    expect(await projects.memoryProjects.get(A, p.id)).toMatchObject({ status: "attention" });
    expect(synth).toHaveBeenCalledTimes(1);

    await expect(service().retry(A, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const again = await service().retry(A, r.id);
    expect(again).toMatchObject({ status: "queued", attempts: 2, error: null });
    await expect(service().retry(A, r.id)).rejects.toMatchObject({ code: "NOT_RETRYABLE" });
    expect(await projects.memoryProjects.get(A, p.id)).toMatchObject({ status: "generating" });
    await job.renderJob(steps().s, r.id, deps());
    expect(synth).toHaveBeenCalledTimes(1); // same narration and voice: the recording is reused
    synth.mockRestore();
  });

  it("fails with the voice's own message when the voice can't be made", async () => {
    const p = await projectWithStoryboard();
    const r = await service().create(A, p.id);
    const limit = new errors.ApiError("LIMIT_REACHED", "You've recorded a lot of voiceovers today. Try again tomorrow.");
    await job.renderJob(steps().s, r.id, deps({ recordVoice: async () => Promise.reject(limit) }));
    expect(await repo.memoryRenders.byId(r.id)).toMatchObject({
      status: "failed",
      error: { code: "LIMIT_REACHED", stage: "voice", message: limit.message },
    });
  });

  it("lets a busy voice service throw, so the step is retried", async () => {
    const p = await projectWithStoryboard();
    const r = await service().create(A, p.id);
    const busy = new errors.ApiError("VOICE_UNAVAILABLE", "busy");
    await expect(job.renderJob(steps().s, r.id, deps({ recordVoice: async () => Promise.reject(busy) }))).rejects.toBe(busy);
    // Inngest's failure handler then gives up cleanly.
    await job.markFailed(deps(), r.id, { code: "RENDER_FAILED", message: "Something went wrong." });
    expect(await repo.memoryRenders.byId(r.id)).toMatchObject({ status: "failed", error: { stage: "voice" } });
  });

  it("gives up after the time limit", async () => {
    const p = await projectWithStoryboard();
    const r = await service().create(A, p.id);
    const slow = rendererMod.fakeRenderer(10_000_000);
    // A huge poll interval means just one or two polls fit in the 15 minutes, all "running".
    const sleeps = vi.fn();
    await job.renderJob(
      { run: (_n, fn) => fn(), sleep: async (n) => void sleeps(n) },
      r.id,
      deps({ renderer: () => slow, pollMs: job.RENDER_TIMEOUT_MS / 2 }),
    );
    expect(sleeps).toHaveBeenCalledTimes(2);
    expect(await repo.memoryRenders.byId(r.id)).toMatchObject({ status: "failed", error: { code: "RENDER_TIMEOUT" } });
  });

  it("finishes a retried save step without uploading again", async () => {
    const p = await projectWithStoryboard();
    const r = await service().create(A, p.id);
    let failOnce = true;
    const flaky = {
      ...projects.memoryProjects,
      setRenderState: async (...args: Parameters<typeof projects.memoryProjects.setRenderState>) => {
        if (failOnce && args[2].status === "ready") {
          failOnce = false;
          throw new Error("db blip");
        }
        return projects.memoryProjects.setRenderState(...args);
      },
    };
    const fake = rendererMod.fakeRenderer(60);
    const save = vi.fn(fake.save);
    // Like Inngest: a step that throws is run again.
    const retrying: import("./job").Steps = {
      run: async (_n, fn) => fn().catch(() => fn()),
      sleep: (_n, ms) => new Promise((res) => setTimeout(res, ms)),
    };
    await job.renderJob(retrying, r.id, deps({ projects: flaky, renderer: () => ({ ...fake, save }) }));
    expect((await repo.memoryRenders.byId(r.id))?.status).toBe("ready");
    expect((await projects.memoryProjects.get(A, p.id))?.status).toBe("ready");
    expect(save).toHaveBeenCalledTimes(1);
  }, 30_000);
});

describe("stuck renders", () => {
  const later = (ms: number) => () => new Date(Date.now() + ms);
  const svcAt = (now: () => Date) =>
    svcMod.renderService({ renders: repo.memoryRenders, projects: projects.memoryProjects, storyboards: sbRepo.memoryStoryboards, dispatch: async () => {}, now });

  it("fails a render whose job never started, so a new one can be made", async () => {
    const p = await projectWithStoryboard();
    const r = await service().create(A, p.id);
    // Still queued 5 minutes on: left alone.
    await expect(svcAt(later(5 * 60_000)).get(A, r.id)).resolves.toMatchObject({ status: "queued" });
    await expect(svcAt(later(5 * 60_000)).create(A, p.id)).rejects.toMatchObject({ code: "RENDER_RUNNING" });
    // 11 minutes on: failed with a clear message, the project needs attention, and it can be retried.
    const shown = await svcAt(later(11 * 60_000)).get(A, r.id);
    expect(shown).toMatchObject({ status: "failed", error: { code: "RENDER_TIMEOUT", stage: "voice" } });
    expect((await projects.memoryProjects.get(A, p.id))?.status).toBe("attention");
    await expect(svcAt(later(11 * 60_000)).retry(A, r.id)).resolves.toMatchObject({ status: "queued", attempts: 2 });
  });

  it("frees the running limit and the video when renders are stuck", async () => {
    const ps = [await projectWithStoryboard(), await projectWithStoryboard(), await projectWithStoryboard(), await projectWithStoryboard()];
    for (const p of ps.slice(0, 3)) {
      const r = await service().create(A, p.id);
      await repo.memoryRenders.update(r.id, { status: "running", stage: "setup" });
    }
    await expect(svcAt(later(20 * 60_000)).create(A, ps[3].id)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    await expect(svcAt(later(26 * 60_000)).create(A, ps[3].id)).resolves.toMatchObject({ status: "queued" });
    await expect(svcAt(later(26 * 60_000)).create(A, ps[0].id)).resolves.toMatchObject({ status: "queued" });
  }, 30_000);

  it("hides another person's project from the latest render", async () => {
    const p = await projectWithStoryboard();
    await expect(service().latest(B, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service().latest(A, p.id)).resolves.toBeNull();
  });
});

