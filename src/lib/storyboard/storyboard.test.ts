import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DB_DRIVER = "memory";
process.env.AI_DRIVER = "fake";

let types: typeof import("./types");
let repo: typeof import("./repo");
let svcMod: typeof import("./service");
let writer: typeof import("./writer");
let projects: typeof import("../projects/memory");
let projectSvc: typeof import("../projects/service");
let chat: typeof import("../chat/repo");
let sbChat: typeof import("../chat/storyboard-chat");
let ideaChat: typeof import("../chat/idea-chat");

beforeAll(async () => {
  types = await import("./types");
  repo = await import("./repo");
  svcMod = await import("./service");
  writer = await import("./writer");
  projects = await import("../projects/memory");
  projectSvc = await import("../projects/service");
  chat = await import("../chat/repo");
  sbChat = await import("../chat/storyboard-chat");
  ideaChat = await import("../chat/idea-chat");
});

beforeEach(() => {
  projects.resetMemoryProjects();
  repo.resetMemoryStoryboards();
  chat.resetMemoryChat();
});

const A = "user-a";

function svc() {
  return svcMod.storyboardService({ projects: projects.memoryProjects, storyboards: repo.memoryStoryboards, writer: writer.geminiWriter });
}

async function projectWithBrief(complete = true) {
  const p = await projectSvc.projectService(projects.memoryProjects).create(A);
  const brief = { title: "How rainbows form", audience: "", keyPoints: complete ? ["Light bends"] : [], angle: "", tone: "", targetSeconds: 75, length: "long" as const };
  return projectSvc.projectService(projects.memoryProjects).patch(A, p.id, { rev: 0, brief });
}

describe("storyboard helpers", () => {
  it("moves cues that left the narration onto real words, in order", () => {
    const scene = types.repairCues({
      type: "flow",
      narration: "First water warms, then it rises, and finally it falls.",
      heading: "Cycle",
      steps: [
        { icon: "Sun", label: "Warm", cue: "warms," },
        { icon: "Cloud", label: "Rise", cue: "gone" },
        { icon: "CloudRain", label: "Fall", cue: "falls" },
      ],
    });
    expect(scene.type === "flow" && scene.steps.map((s) => s.cue)).toEqual(["warms", expect.any(String), "falls"]);
  });

  it("reads a 3D scene from the model, fixing its preset and cues", () => {
    const raw = (preset: string | undefined, items: { label: string; cue: string }[]) => ({
      type: "scene3d" as const,
      narration: "Glass shatters first, then wood splits, and steel finally stops it.",
      heading: "Breaking barriers",
      preset,
      items,
    });
    const three = [
      { label: "Glass", cue: "Glass" },
      { label: "Wood", cue: "nowhere" },
      { label: "Steel", cue: "steel" },
    ];
    const s = writer.toScene(raw(" Impact ", three));
    expect(s?.type === "scene3d" && s.preset).toBe("impact");
    expect(s?.type === "scene3d" && s.items.map((i) => i.cue)).toEqual(["Glass", expect.any(String), "steel"]);
    expect(types.sceneSchema.safeParse(s).success).toBe(true);
    // Unknown preset: falls back to orbit. Too many items: capped at 4. No items: dropped.
    expect(writer.toScene(raw("tornado", three))).toMatchObject({ preset: "orbit" });
    const many = writer.toScene(raw(undefined, [...three, ...three]));
    expect(many?.type === "scene3d" && many.items).toHaveLength(4);
    expect(writer.toScene(raw("orbit", []))).toBeNull();
    // Round trip through the flat shape keeps everything.
    expect(writer.toScene(writer.toRaw(s!))).toEqual(s);
  });

  it("keeps at most two 3D scenes and turns the rest into summaries", async () => {
    const three = (h: string) => ({ type: "scene3d" as const, narration: `${h} moves fast.`, heading: h, preset: "stack" as const, items: [{ label: h, cue: "moves" }] });
    const out = types.cap3d([three("A"), { type: "title", narration: "Hi there.", title: "T" }, three("B"), three("C")]);
    expect(out.map((s) => s.type)).toEqual(["scene3d", "title", "scene3d", "summary"]);
    expect(out[3]).toEqual({ type: "summary", narration: "C moves fast.", heading: "C", points: [{ text: "C", cue: "moves" }] });
    expect(types.sceneSchema.safeParse(out[3]).success).toBe(true);
    // A 3D scene with a long narration (too slow to render) becomes a summary and doesn't use up a 3D slot.
    const long = { ...three("L"), narration: "L moves fast. ".repeat(20).trim() };
    expect(types.cap3d([long, three("A"), three("B")]).map((s) => s.type)).toEqual(["summary", "scene3d", "scene3d"]);
    // An edited storyboard saved through the API is capped the same way.
    const { parseStoryboard } = await import("./schemas");
    const saved = parseStoryboard({ topic: "t", title: "T", scenes: [three("A"), three("B"), three("C"), three("D")] });
    expect(saved.scenes.map((s) => s.type)).toEqual(["scene3d", "scene3d", "summary", "summary"]);
  });

  it("accepts the 3D model library presets", () => {
    expect(types.MAX_3D_NARRATION).toBeGreaterThanOrEqual(200);
    for (const preset of ["dna", "cell", "heart", "brain", "rocket", "highway", "hourglass"]) {
      const s = writer.toScene({ type: "scene3d", narration: "It moves fast.", heading: "H", preset: preset.toUpperCase(), items: [{ label: "A", cue: "moves" }] });
      expect(s).toMatchObject({ type: "scene3d", preset });
      expect(types.sceneSchema.safeParse(s).success).toBe(true);
      expect(s && types.sceneVisual(s)).toMatch(/^3D /);
    }
  });

  it("rejects a 3D scene with an unknown preset or no items", () => {
    const base = { type: "scene3d", narration: "Planets circle the sun.", heading: "Orbits", preset: "orbit", items: [{ label: "Earth", cue: "Planets" }] };
    expect(types.sceneSchema.safeParse(base).success).toBe(true);
    expect(types.sceneSchema.safeParse({ ...base, preset: "tornado" }).success).toBe(false);
    expect(types.sceneSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });

  it("lists the scenes that changed", () => {
    const a = { topic: "t", title: "t", scenes: [{ type: "title" as const, narration: "a b", title: "A" }] };
    const b = { ...a, scenes: [...a.scenes, { type: "title" as const, narration: "c d", title: "B" }] };
    expect(types.changedScenes(a, b)).toEqual([1]);
    expect(types.changedScenes(null, b)).toEqual([0, 1]);
  });
});

describe("storyboard service", () => {
  it("writes version 1 from the brief, locks the brief and moves to step 2", async () => {
    const p = await projectWithBrief();
    const out = await svc().generate(A, p.id, p.rev);
    expect(out.version).toMatchObject({ version: 1, createdBy: "ai", canUndo: false });
    expect(out.version.storyboard.scenes[0].type).toBe("title");
    expect(out.version.estSeconds).toBeGreaterThanOrEqual(60);
    expect(out.warnings).toEqual([]);
    expect(out.project).toMatchObject({ status: "storyboard", step: "storyboard", currentVersion: 1 });
    await expect(svc().generate(A, p.id, out.rev)).rejects.toMatchObject({ code: "STORYBOARD_EXISTS" });
    // The brief can't change any more, by hand or by the idea chat.
    await expect(
      projectSvc.projectService(projects.memoryProjects).patch(A, p.id, { rev: out.rev, brief: null }),
    ).rejects.toMatchObject({ code: "BRIEF_LOCKED" });
    await expect(
      ideaChat.ideaChat({ projects: projects.memoryProjects, chat: chat.memoryChat }, { userId: A, projectId: p.id, rev: out.rev, text: "hi" }),
    ).rejects.toMatchObject({ code: "BRIEF_LOCKED" });
  });

  it("needs a complete brief and the current rev", async () => {
    const p = await projectWithBrief(false);
    await expect(svc().generate(A, p.id, p.rev)).rejects.toMatchObject({ code: "BRIEF_INCOMPLETE" });
    await expect(svc().generate(A, p.id, 99)).rejects.toMatchObject({ code: "REV_CONFLICT" });
    await expect(svc().generate("user-b", p.id, p.rev)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("only one of two simultaneous writes wins", async () => {
    const p = await projectWithBrief();
    const results = await Promise.allSettled([svc().generate(A, p.id, p.rev), svc().generate(A, p.id, p.rev)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await repo.memoryStoryboards.list(A, p.id)).length).toBe(1);
  });

  it("saves edits as new versions, checks the base version, and undoes back along the chain", async () => {
    const p = await projectWithBrief();
    const v1 = await svc().generate(A, p.id, p.rev);
    const sb = structuredClone(v1.version.storyboard);
    sb.scenes[1].narration = "A shorter line about light.";
    const v2 = await svc().save(A, p.id, { rev: v1.rev, baseVersion: 1, storyboard: sb });
    expect(v2.version).toMatchObject({ version: 2, createdBy: "user", changedScenes: [1], canUndo: true });

    await expect(svc().save(A, p.id, { rev: v2.rev, baseVersion: 1, storyboard: sb })).rejects.toMatchObject({ code: "REV_CONFLICT" });
    await expect(
      svc().save(A, p.id, { rev: v2.rev, baseVersion: 2, storyboard: { ...sb, scenes: sb.scenes.slice(0, 2) } }),
    ).rejects.toMatchObject({ code: "TOO_FEW_SCENES" });

    const short = { ...sb, scenes: sb.scenes.slice(0, 3) };
    const v3 = await svc().save(A, p.id, { rev: v2.rev, baseVersion: 2, storyboard: short });
    expect(v3.warnings).toEqual(["LENGTH_OUT_OF_RANGE"]);

    const u1 = await svc().undo(A, p.id, v3.rev);
    expect(u1.version).toMatchObject({ version: 4, canUndo: true, changeNote: "Back to version 2" });
    expect(u1.version.storyboard).toEqual(v2.version.storyboard);
    const u2 = await svc().undo(A, p.id, u1.rev);
    expect(u2.version.storyboard).toEqual(v1.version.storyboard);
    expect(u2.version.canUndo).toBe(false);
    await expect(svc().undo(A, p.id, u2.rev)).rejects.toMatchObject({ code: "NOTHING_TO_UNDO" });

    expect((await svc().versions(A, p.id)).map((v) => v.version)).toEqual([5, 4, 3, 2, 1]);
    expect((await svc().get(A, p.id, 2)).storyboard).toEqual(v2.version.storyboard);
  });

  it("regenerates one scene and leaves the others", async () => {
    const p = await projectWithBrief();
    const v1 = await svc().generate(A, p.id, p.rev);
    const out = await svc().regenerateScene(A, p.id, 2, { rev: v1.rev });
    expect(out.version.changedScenes).toEqual([2]);
    expect(out.version.storyboard.scenes[2].narration).toMatch(/^Put another way/);
    await expect(svc().regenerateScene(A, p.id, 40, { rev: out.rev })).rejects.toMatchObject({ code: "SCENE_NOT_FOUND" });
  });
});

describe("storyboard recovery", () => {
  it("removes the version when the project update throws", async () => {
    const p = await projectWithBrief();
    const v1 = await svc().generate(A, p.id, p.rev);
    const flaky = { ...projects.memoryProjects, update: async () => { throw new Error("network blip"); } };
    const bad = svcMod.storyboardService({ projects: flaky, storyboards: repo.memoryStoryboards, writer: writer.geminiWriter });
    await expect(bad.regenerateScene(A, p.id, 1, { rev: v1.rev })).rejects.toThrow("network blip");
    const out = await svc().regenerateScene(A, p.id, 1, { rev: v1.rev });
    expect(out.version.version).toBe(2);
  });

  it("clears a version left behind by a save that died before its project update", async () => {
    const p = await projectWithBrief();
    const v1 = await svc().generate(A, p.id, p.rev);
    const orphan = await repo.memoryStoryboards.get(A, p.id, 1);
    await repo.memoryStoryboards.insert({ ...orphan!, id: "orphan", version: 2, parentVersion: 1 });
    const sb = structuredClone(v1.version.storyboard);
    sb.scenes[1].narration = "Light bends in raindrops.";
    const out = await svc().save(A, p.id, { rev: v1.rev, baseVersion: 1, storyboard: sb });
    expect(out.version).toMatchObject({ version: 2, changedScenes: [1] });
    expect((await svc().get(A, p.id)).storyboard.scenes[1].narration).toBe("Light bends in raindrops.");
  });
});

describe("storyboard chat", () => {
  async function readSse(res: Response) {
    return (await res.text())
      .split("\n\n")
      .map((b) => b.replace(/^data: /, "").trim())
      .filter((b) => b && b !== "[DONE]")
      .map((b) => JSON.parse(b) as { type: string; data?: unknown });
  }

  it("revises the storyboard as a new version and sends it as a data part", async () => {
    const p = await projectWithBrief();
    const v1 = await svc().generate(A, p.id, p.rev);
    const deps = { projects: projects.memoryProjects, chat: chat.memoryChat, storyboards: repo.memoryStoryboards, writer: writer.geminiWriter };
    const res = await sbChat.storyboardChat(deps, { userId: A, projectId: p.id, rev: v1.rev, text: "Make scene 2 punchier" });
    const parts = await readSse(res);
    const data = parts.find((x) => x.type === "data-storyboard")?.data as { version: { version: number; changedScenes: number[] }; rev: number };
    expect(data.version).toMatchObject({ version: 2, changedScenes: [1] });
    expect((await projects.memoryProjects.get(A, p.id))?.rev).toBe(data.rev);
    const msgs = await chat.memoryChat.list(A, p.id, "storyboard");
    expect(msgs[1].toolResult).toMatchObject({ storyboard: { version: 2 } });
    // The idea chat is separate.
    expect(await chat.memoryChat.list(A, p.id, "idea")).toHaveLength(0);
  });

  it("needs a storyboard first", async () => {
    const p = await projectWithBrief();
    const deps = { projects: projects.memoryProjects, chat: chat.memoryChat, storyboards: repo.memoryStoryboards, writer: writer.geminiWriter };
    await expect(sbChat.storyboardChat(deps, { userId: A, projectId: p.id, rev: p.rev, text: "hi" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("icons", () => {
  it("only hands out icons the video can draw", async () => {
    const { icons } = await import("lucide");
    const { resolveIcon, SUGGESTED_ICONS } = await import("./icons");
    for (const name of ["Cheese", "Moped", "cloud-rain", "Home", "nonsense-icon", ...SUGGESTED_ICONS]) {
      expect(icons).toHaveProperty(resolveIcon(name));
    }
    expect(resolveIcon("cloud-rain")).toBe("CloudRain");
  });
});
