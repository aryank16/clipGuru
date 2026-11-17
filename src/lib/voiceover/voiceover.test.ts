import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DB_DRIVER = "memory";
process.env.AI_DRIVER = "fake";

let svcMod: typeof import("./service");
let repo: typeof import("./repo");
let tts: typeof import("./tts");
let storage: typeof import("../storage");
let sbRepo: typeof import("../storyboard/repo");
let sbSvc: typeof import("../storyboard/service");
let writer: typeof import("../storyboard/writer");
let projects: typeof import("../projects/memory");
let projectSvc: typeof import("../projects/service");
let voices: typeof import("../defaults");
let errors: typeof import("../api/errors");

beforeAll(async () => {
  svcMod = await import("./service");
  repo = await import("./repo");
  tts = await import("./tts");
  storage = await import("../storage");
  sbRepo = await import("../storyboard/repo");
  sbSvc = await import("../storyboard/service");
  writer = await import("../storyboard/writer");
  projects = await import("../projects/memory");
  projectSvc = await import("../projects/service");
  voices = await import("../defaults");
  errors = await import("../api/errors");
});

beforeEach(() => {
  projects.resetMemoryProjects();
  sbRepo.resetMemoryStoryboards();
  repo.resetMemoryVoiceovers();
  storage.resetMemoryStorage();
});

const A = "user-a";
const B = "user-b";

function svc(over: Partial<Parameters<typeof import("./service").voiceoverService>[0]> = {}) {
  return svcMod.voiceoverService({
    projects: projects.memoryProjects,
    storyboards: sbRepo.memoryStoryboards,
    voiceovers: repo.memoryVoiceovers,
    storage: () => storage.memoryStorage,
    tts: () => tts.fakeTts,
    ...over,
  });
}

const storyboards = () =>
  sbSvc.storyboardService({ projects: projects.memoryProjects, storyboards: sbRepo.memoryStoryboards, writer: writer.geminiWriter });

async function projectWithStoryboard() {
  const ps = projectSvc.projectService(projects.memoryProjects);
  const p = await ps.create(A);
  const brief = { title: "How rainbows form", audience: "", keyPoints: ["Light bends"], angle: "", tone: "", targetSeconds: 75, length: "auto" as const };
  const withBrief = await ps.patch(A, p.id, { rev: 0, brief });
  const saved = await storyboards().generate(A, p.id, withBrief.rev);
  return saved;
}

describe("voiceover helpers", () => {
  it("turns ElevenLabs character times into words", () => {
    const chars = "Hi there".split("");
    const words = tts.alignmentToWords({
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1),
      character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
    });
    expect(words).toEqual([
      { text: "Hi", start: 0, end: 0.2 },
      { text: "there", start: 0.3, end: 0.8 },
    ]);
  });

  it("speeds up only past 90 seconds, and never beyond 1.1", () => {
    const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
    expect(svcMod.speedFor(words(180))).toBe(1);
    expect(svcMod.speedFor(words(230))).toBeGreaterThan(1);
    expect(svcMod.speedFor(words(230))).toBeLessThanOrEqual(1.1);
    expect(svcMod.speedFor(words(400))).toBe(1.1);
  });

  it("hashes voice, model, speed and narration", () => {
    const h = svcMod.hashOf("v", "m", 1, "text");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(svcMod.hashOf("v2", "m", 1, "text")).not.toBe(h);
    expect(svcMod.hashOf("v", "m", 1.05, "text")).not.toBe(h);
    expect(svcMod.hashOf("v", "m", 1, "text!")).not.toBe(h);
  });
});

describe("voiceover service", () => {
  it("records once, stores the audio, and reuses it while nothing changed", async () => {
    const { project } = await projectWithStoryboard();
    const synth = vi.spyOn(tts.fakeTts, "synthesize");
    expect(await svc().find(A, project.id)).toBeNull();

    const first = await svc().create(A, project.id);
    expect(first.reused).toBe(false);
    expect(first.voiceover.voiceName).toBe("George");
    expect(first.voiceover.audioUrl).toBe(`/api/voiceovers/${first.voiceover.id}/audio`);
    const rec = await repo.memoryVoiceovers.get(A, first.voiceover.id);
    expect(rec?.wordMismatch).toBe(0);
    expect(rec?.audioKey).toMatch(new RegExp(`^users/${A}/projects/${project.id}/voice/[0-9a-f]{64}\\.wav$`));
    expect((await storage.memoryStorage.read!(rec!.audioKey))?.contentType).toBe("audio/wav");
    expect(first.voiceover.durationSec).toBeGreaterThan(first.voiceover.words.at(-1)!.end);

    const again = await svc().create(A, project.id);
    expect(again.reused).toBe(true);
    expect(again.voiceover.id).toBe(first.voiceover.id);
    expect((await svc().find(A, project.id))?.id).toBe(first.voiceover.id);
    expect(synth).toHaveBeenCalledTimes(1);
    synth.mockRestore();
  });

  it("records again after a new voice or an edited narration", async () => {
    const saved = await projectWithStoryboard();
    const first = await svc().create(A, saved.project.id);

    const ps = projectSvc.projectService(projects.memoryProjects);
    const p2 = await ps.patch(A, saved.project.id, { rev: saved.rev, voiceId: voices.VOICE_ALICE });
    expect(await svc().find(A, p2.id)).toBeNull();
    const alice = await svc().create(A, p2.id);
    expect(alice.voiceover.voiceName).toBe("Alice");
    expect(alice.voiceover.id).not.toBe(first.voiceover.id);

    const sb = saved.version.storyboard;
    const edited = { ...sb, scenes: sb.scenes.map((s, i) => (i === 1 ? { ...s, narration: s.narration + " Simple." } : s)) };
    const v2 = await storyboards().save(A, p2.id, { rev: p2.rev, baseVersion: 1, storyboard: edited });
    const fresh = await svc().create(A, p2.id);
    expect(fresh.reused).toBe(false);
    // The older version still finds its own recording.
    expect((await svc().find(A, p2.id, 1))?.id).toBe(alice.voiceover.id);
    expect(v2.version.version).toBe(2);
  });

  it("keeps each user's voiceovers to themselves", async () => {
    const { project } = await projectWithStoryboard();
    const { voiceover } = await svc().create(A, project.id);
    await expect(svc().create(B, project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await svc().get(B, voiceover.id)).toBeNull();
    expect(await repo.memoryVoiceovers.deleteAllForUser(A)).toBe(1);
    expect(await storage.memoryStorage.deletePrefix(storage.userPrefix(A))).toBe(1);
  });

  it("says plainly when the voice fails or isn't set up, and saves nothing", async () => {
    const { project } = await projectWithStoryboard();
    const broken = { model: "x", synthesize: async () => Promise.reject(new Error("down")) };
    await expect(svc({ tts: () => broken }).create(A, project.id)).rejects.toMatchObject({ code: "VOICE_UNAVAILABLE" });
    const missing = () => {
      throw new errors.ApiError("VOICE_UNAVAILABLE", "not set up");
    };
    await expect(svc({ tts: missing }).create(A, project.id)).rejects.toMatchObject({ code: "VOICE_UNAVAILABLE" });
    expect(await svc({ tts: missing }).find(A, project.id)).toBeNull();
    await expect(svc({ storage: missing }).create(A, project.id)).rejects.toMatchObject({ code: "VOICE_UNAVAILABLE" });
    const broken2 = { ...storage.memoryStorage, put: () => Promise.reject(new Error("bad header")) };
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(svc({ storage: () => broken2 }).create(A, project.id)).rejects.toMatchObject({
      code: "VOICE_UNAVAILABLE",
      message: expect.stringContaining("couldn't be saved"),
    });
    expect(await repo.memoryVoiceovers.countSince(A, new Date(0))).toBe(0);
  });

  it("stops at the daily limit but still reuses existing recordings", async () => {
    const { project } = await projectWithStoryboard();
    const made = await svc().create(A, project.id);
    const rec = (await repo.memoryVoiceovers.get(A, made.voiceover.id))!;
    for (let i = 1; i < 30; i++) await repo.memoryVoiceovers.insert({ ...rec, id: `x${i}`, projectId: `other${i}` });
    expect((await svc().create(A, project.id)).reused).toBe(true);
    const ps = projectSvc.projectService(projects.memoryProjects);
    const latest = (await projects.memoryProjects.get(A, project.id))!;
    await ps.patch(A, project.id, { rev: latest.rev, voiceId: voices.VOICE_ALICE });
    await expect(svc().create(A, project.id)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });

  it("uses the winner when two requests record the same narration", async () => {
    const { project } = await projectWithStoryboard();
    const [a, b] = await Promise.all([svc().create(A, project.id), svc().create(A, project.id)]);
    expect(a.voiceover.id).toBe(b.voiceover.id);
    expect(await repo.memoryVoiceovers.countSince(A, new Date(0))).toBe(1);
  });
});
