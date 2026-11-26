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
    expect(done?.covers).toHaveLength(3);
    expect(done?.coverIndex).toBe(0);
    expect(done?.thumbKey).toBe(done?.covers?.[0].key);
    expect(done?.bytes).toBeGreaterThan(0);
    for (const c of done!.covers!) expect(await storage.memoryStorage.read!(c.key)).toBeTruthy();
    const frames = done!.covers!.map((c) => c.frame);
    expect(new Set(frames).size).toBe(3);
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
    expect(done?.voiceoverId).toBeTruthy();
    expect(done?.durationSec).toBeGreaterThan(10);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(await projects.memoryProjects.get(A, p.id)).toMatchObject({ status: "ready", latestRenderId: r.id, rev: p.rev });

    const shown = await service().get(A, r.id);
    expect(shown).toMatchObject({
      videoUrl: `/api/renders/${r.id}/video`,
      downloadUrl: `/api/renders/${r.id}/download`,
      thumbnailUrl: `/api/renders/${r.id}/thumbnail?c=0`,
      coverIndex: 0,
    });
    expect(shown.covers.map((c) => c.url)).toEqual([0, 1, 2].map((i) => `/api/renders/${r.id}/covers/${i}`));
    expect(shown.covers[0].offsetMs).toBe(Math.round((done!.covers![0].frame / 30) * 1000));
  });

  it("lets the owner pick a ready video's cover, and nobody else", async () => {
    const p = await projectWithStoryboard();
    const r = await service().create(A, p.id);
    await expect(service().setCover(A, r.id, 1)).rejects.toMatchObject({ code: "RENDER_NOT_READY" });
    await job.renderJob(steps().s, r.id, deps());

    const picked = await service().setCover(A, r.id, 2);
    expect(picked).toMatchObject({ coverIndex: 2, thumbnailUrl: `/api/renders/${r.id}/thumbnail?c=2` });
    const rec = await repo.memoryRenders.byId(r.id);
    expect(rec?.thumbKey).toBe(rec?.covers?.[2].key);

    for (const bad of [3, -1, 1.5, "1", null]) {
      await expect(service().setCover(A, r.id, bad)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    }
    await expect(service().setCover(B, r.id, 0)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await repo.memoryRenders.byId(r.id))?.coverIndex).toBe(2);
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

describe("cover frames", () => {
  const props = (n: number, durationSec: number) => {
    const scenes = Array.from({ length: n }, (_, i) => ({ type: "title", heading: `S${i}`, narration: `scene ${i} words here` }));
    const words = scenes.flatMap((sc, i) =>
      sc.narration.split(" ").map((text, k) => ({ text, start: (i * durationSec) / n + k * 0.3, end: (i * durationSec) / n + k * 0.3 + 0.2 })),
    );
    return { storyboard: { scenes }, words, audioSrc: null, durationSec } as unknown as import("@/video/types").VideoProps;
  };

  it("suggests the title plus a middle and a late scene, each inside the video", () => {
    const f = job.coverFramesOf(props(6, 60));
    expect(f).toHaveLength(3);
    expect(f[0]).toBe(45);
    // Middle scene (3) runs ~29.75 to ~39.75 s; the second-to-last (4) ~39.75 to ~49.75 s.
    expect(f[1]).toBeGreaterThan(30 * 30);
    expect(f[1]).toBeLessThan(40 * 30);
    expect(f[2]).toBeGreaterThan(40 * 30);
    expect(f[2]).toBeLessThan(50 * 30);
  });

  it("still gives three distinct frames for a short storyboard", () => {
    const f = job.coverFramesOf(props(2, 8));
    expect(f).toHaveLength(3);
    expect(new Set(f).size).toBe(3);
    for (const x of f) expect(x).toBeLessThan(8 * 30);
  });
});

describe("download names", () => {
  it("names the file after the title, safely", async () => {
    const { fileNameFor } = await import("../api/serve-file");
    expect(fileNameFor("Where does rain come from?", "mp4")).toBe("Where-does-rain-come-from.mp4");
    expect(fileNameFor("Café: 50% off / now", "mp4")).toBe("Cafe-50-off-now.mp4");
    expect(fileNameFor("   ", "mp4")).toBe("clipguru-video.mp4");
    expect(fileNameFor("x".repeat(200), "mp4")).toHaveLength(84);
    expect(storage.attachment("Café.mp4")).toBe(`attachment;filename="Caf_.mp4";filename*=UTF-8''Caf%C3%A9.mp4`);
  });
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


describe("monthly video limit", () => {
  const monthly = (max: number, at: string) =>
    svcMod.renderService({
      renders: repo.memoryRenders,
      projects: projects.memoryProjects,
      storyboards: sbRepo.memoryStoryboards,
      dispatch: async () => {},
      videosPerMonth: max,
      now: () => new Date(at),
    });

  it("counts this month's videos, leaves out failed ones, and stops at the limit", async () => {
    const p = await projectWithStoryboard();
    const r = await monthly(2, "2026-11-26T12:00:00Z").create(A, p.id);
    expect(await monthly(2, "2026-11-26T12:00:00Z").usage(A)).toEqual({
      used: 1,
      max: 2,
      left: 1,
      resetsAt: "2026-12-01T00:00:00.000Z",
    });
    // A failed video doesn't use up the allowance.
    await repo.memoryRenders.update(r.id, { status: "failed" });
    expect((await monthly(2, "2026-11-26T12:00:00Z").usage(A)).used).toBe(0);
    // Two made videos (a ready one and one from another project) reach the limit.
    await repo.memoryRenders.insert({ ...(await repo.memoryRenders.byId(r.id))!, id: "old1", projectId: "other1", status: "ready" });
    await repo.memoryRenders.insert({ ...(await repo.memoryRenders.byId(r.id))!, id: "old2", projectId: "other2", status: "ready" });
    await expect(monthly(2, "2026-11-26T12:00:00Z").create(A, p.id)).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      details: { limit: "videos_per_month", max: 2 },
      message: expect.stringContaining("1 December"),
    });
    // Another person isn't affected, and the next month starts afresh.
    expect((await monthly(2, "2026-11-26T12:00:00Z").usage(B)).left).toBe(2);
    expect((await monthly(2, "2026-12-01T00:00:01Z").usage(A)).used).toBe(0);
  });

  it("counts a failed video again when it is retried, so retrying can't go over the limit", async () => {
    const p = await projectWithStoryboard();
    const svc1 = monthly(1, "2026-11-26T12:00:00Z");
    const r = await svc1.create(A, p.id);
    await repo.memoryRenders.update(r.id, { status: "failed" });
    await projects.memoryProjects.setRenderState(A, p.id, { status: "attention", step: "generate", latestRenderId: r.id }, new Date());
    const other = await projectWithStoryboard();
    await svc1.create(A, other.id); // uses the one video of the month
    await expect(svc1.retry(A, r.id)).rejects.toMatchObject({ code: "LIMIT_REACHED", details: { limit: "videos_per_month" } });
  });

  it("has no limit when set to 0", async () => {
    const p = await projectWithStoryboard();
    expect(await monthly(0, "2026-11-26T12:00:00Z").usage(A)).toMatchObject({ max: null, left: null });
    await expect(monthly(0, "2026-11-26T12:00:00Z").create(A, p.id)).resolves.toMatchObject({ status: "queued" });
  });

  it("fails the video straight away, with a clear message, when the voice credits are used up", async () => {
    const p = await projectWithStoryboard();
    const r = await service().create(A, p.id);
    const out = { model: "x", synthesize: async () => Promise.reject(new tts.VoiceQuotaError("quota_exceeded")) };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const voicesOut = voSvc.voiceoverService({
      projects: projects.memoryProjects,
      storyboards: sbRepo.memoryStoryboards,
      voiceovers: voRepo.memoryVoiceovers,
      storage: () => storage.memoryStorage,
      tts: () => out,
    });
    await job.renderJob(steps().s, r.id, deps({ recordVoice: async (u, pid, v) => (await voicesOut.create(u, pid, v)).voiceover }));
    expect(await repo.memoryRenders.byId(r.id)).toMatchObject({
      status: "failed",
      error: { code: "VOICE_CREDITS_USED_UP", stage: "voice", message: expect.stringContaining("voice credits") },
    });
  });
});
