import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { briefComplete, emptyBrief, mergeBrief, toBrief } from "../brief";
import { ApiError } from "../api/errors";

vi.mock("server-only", () => ({}));
process.env.DB_DRIVER = "memory";
process.env.AI_DRIVER = "fake";

// Loaded after the env above, since env() is read once.
let mod: typeof import("./idea-chat");
let chat: typeof import("./repo");
let projects: typeof import("../projects/memory");
let service: typeof import("../projects/service");

beforeAll(async () => {
  mod = await import("./idea-chat");
  chat = await import("./repo");
  projects = await import("../projects/memory");
  service = await import("../projects/service");
});

beforeEach(() => {
  chat.resetMemoryChat();
  projects.resetMemoryProjects();
});

const A = "user-a";

async function readSse(res: Response) {
  const text = await res.text();
  return text
    .split("\n\n")
    .map((b) => b.replace(/^data: /, "").trim())
    .filter((b) => b && b !== "[DONE]")
    .map((b) => JSON.parse(b) as { type: string; delta?: string; data?: unknown });
}

describe("brief", () => {
  it("reads partial or odd stored briefs", () => {
    expect(toBrief(null)).toEqual(emptyBrief());
    expect(toBrief({ title: "Tides", keyPoints: ["Moon", 3], targetSeconds: 200 })).toMatchObject({
      title: "Tides",
      keyPoints: ["Moon"],
      targetSeconds: 75,
    });
  });

  it("merges updates without wiping fields with blanks", () => {
    const b = { ...emptyBrief(), title: "Tides", audience: "Kids" };
    const next = mergeBrief(b, { audience: "  ", keyPoints: ["Moon pulls water", " "], tone: "Calm and clear" });
    expect(next).toMatchObject({ title: "Tides", audience: "Kids", keyPoints: ["Moon pulls water"], tone: "Calm and clear" });
    expect(briefComplete(next)).toBe(true);
    expect(briefComplete(b)).toBe(false);
  });
});

describe("idea chat", () => {
  it("streams a reply, saves the brief and both messages, and names the video", async () => {
    const svc = service.projectService(projects.memoryProjects);
    const p = await svc.create(A);
    const res = await mod.ideaChat(
      { projects: projects.memoryProjects, chat: chat.memoryChat },
      { userId: A, projectId: p.id, rev: 0, text: "How tides work" },
    );
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const parts = await readSse(res);
    const brief = parts.find((x) => x.type === "data-brief")?.data as { rev: number; title: string };
    expect(brief).toMatchObject({ rev: 1, title: "How tides work" });
    expect(parts.filter((x) => x.type === "text-delta").length).toBeGreaterThan(0);

    const saved = await projects.memoryProjects.get(A, p.id);
    expect(saved).toMatchObject({ title: "How tides work", hasChat: true, rev: 1 });
    const msgs = await chat.memoryChat.list(A, p.id, "idea");
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[1].toolResult).toHaveProperty("brief");
  });

  it("returns ideas as a data part", async () => {
    const p = await service.projectService(projects.memoryProjects).create(A);
    const res = await mod.ideaChat(
      { projects: projects.memoryProjects, chat: chat.memoryChat },
      { userId: A, projectId: p.id, rev: 0, text: "Give me 5 ideas" },
    );
    const ideas = (await readSse(res)).find((x) => x.type === "data-ideas")?.data as { ideas: unknown[] };
    expect(ideas.ideas).toHaveLength(5);
  });

  it("answers 503 and marks the message failed when the model is down", async () => {
    const p = await service.projectService(projects.memoryProjects).create(A);
    await expect(
      mod.ideaChat({ projects: projects.memoryProjects, chat: chat.memoryChat }, { userId: A, projectId: p.id, rev: 0, text: "fail" }),
    ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    const [msg] = await chat.memoryChat.list(A, p.id, "idea");
    expect(msg.status).toBe("failed");
  });

  it("rejects a stale rev, another user's video and too many messages", async () => {
    const deps = { projects: projects.memoryProjects, chat: chat.memoryChat };
    const p = await service.projectService(projects.memoryProjects).create(A);
    await expect(mod.ideaChat(deps, { userId: A, projectId: p.id, rev: 5, text: "hi" })).rejects.toMatchObject({
      code: "REV_CONFLICT",
    });
    await expect(mod.ideaChat(deps, { userId: "user-b", projectId: p.id, rev: 0, text: "hi" })).rejects.toBeInstanceOf(
      ApiError,
    );
    for (let i = 0; i < 60; i++) {
      await chat.memoryChat.insert({
        id: `m${i}`,
        projectId: p.id,
        userId: A,
        step: "idea",
        role: "user",
        text: "x",
        toolResult: null,
        status: "ok",
        createdAt: new Date(),
      });
    }
    await expect(mod.ideaChat(deps, { userId: A, projectId: p.id, rev: 0, text: "hi" })).rejects.toMatchObject({
      code: "LIMIT_REACHED",
    });
  });

  it("gives the model earlier turns with a note for what changed", () => {
    const base = { projectId: "p", userId: A, step: "idea" as const, status: "ok" as const, createdAt: new Date() };
    const msgs = mod.historyMessages([
      { ...base, id: "1", role: "user", text: "ideas please", toolResult: null },
      { ...base, id: "2", role: "assistant", text: "Here you go.", toolResult: { ideas: [{ title: "Tides", hook: "h" }] } },
      { ...base, id: "3", role: "user", text: "dropped", toolResult: null, status: "failed" },
    ]);
    expect(msgs).toHaveLength(2);
    expect(msgs[1].content).toContain("Suggested ideas: Tides");
  });
});
