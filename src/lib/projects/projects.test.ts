import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import { memoryProjects, resetMemoryProjects } from "./memory";
import { listQuery, patchBody } from "./schemas";
import { projectService } from "./service";
import { countsFrom, escapeRegex } from "./shared";
import { copyTitle } from "./types";

let clock = new Date("2026-11-13T10:00:00Z");
const tick = () => (clock = new Date(clock.getTime() + 1000));
const svc = projectService(memoryProjects, () => clock);
const A = "user-a";
const B = "user-b";

beforeEach(() => {
  resetMemoryProjects();
  clock = new Date("2026-11-13T10:00:00Z");
});

describe("projects", () => {
  it("creates with design defaults", async () => {
    const p = await svc.create(A, "voice-x");
    expect(p).toMatchObject({ title: "Untitled video", status: "idea", step: "idea", rev: 0, voiceId: "voice-x" });
    expect(p.id).toMatch(/^[0-9a-f]{24}$/);
  });

  it("lists newest edit first and pages with a cursor", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      tick();
      ids.push((await svc.create(A)).id);
    }
    const first = await memoryProjects.list(A, { filter: "all", limit: 2 });
    expect(first.items.map((r) => r.id)).toEqual([ids[4], ids[3]]);
    const second = await memoryProjects.list(A, { filter: "all", limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((r) => r.id)).toEqual([ids[2], ids[1]]);
    const third = await memoryProjects.list(A, { filter: "all", limit: 2, cursor: second.nextCursor! });
    expect(third.items.map((r) => r.id)).toEqual([ids[0]]);
    expect(third.nextCursor).toBeNull();
  });

  it("keeps users apart: another user's video is 404", async () => {
    const p = await svc.create(A);
    await expect(svc.get(B, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(svc.remove(B, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await memoryProjects.list(B, { filter: "all", limit: 20 })).items).toEqual([]);
  });

  it("renames with rev checks", async () => {
    const p = await svc.create(A);
    tick();
    const renamed = await svc.patch(A, p.id, { rev: 0, title: "Black holes" });
    expect(renamed).toMatchObject({ title: "Black holes", rev: 1 });
    expect(renamed.updatedAt > p.updatedAt).toBe(true);
    const err = await svc.patch(A, p.id, { rev: 0, title: "Stale" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "REV_CONFLICT", details: { currentRev: 1 } });
  });

  it("searches titles case-insensitively, including regex characters", async () => {
    const a = await svc.create(A);
    await svc.patch(A, a.id, { rev: 0, title: "Why (the) sky is blue?" });
    const b = await svc.create(A);
    await svc.patch(A, b.id, { rev: 0, title: "Photosynthesis" });
    const hit = await memoryProjects.list(A, { filter: "all", q: "SKY IS", limit: 20 });
    expect(hit.items.map((r) => r.id)).toEqual([a.id]);
    expect((await memoryProjects.list(A, { filter: "all", q: "(the)", limit: 20 })).items).toHaveLength(1);
    expect(escapeRegex("a.b(c)")).toBe("a\\.b\\(c\\)");
  });

  it("filters by status group and counts each tab", async () => {
    await svc.create(A);
    await svc.create(A);
    const counts = await memoryProjects.counts(A);
    expect(counts).toMatchObject({ all: 2, drafts: 2, ready: 0, rendering: 0 });
    expect((await memoryProjects.list(A, { filter: "ready", limit: 20 })).items).toEqual([]);
    expect(countsFrom([["ready", 2], ["generating", 1], ["attention", 1], ["idea", 1]])).toEqual({
      all: 5, drafts: 2, rendering: 1, ready: 2, scheduled: 0, posted: 0,
    });
  });

  it("deletes softly and restores within 30 days", async () => {
    const p = await svc.create(A);
    const res = await svc.remove(A, p.id);
    expect(res.cancelledPosts).toBe(0);
    await expect(svc.get(A, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await memoryProjects.counts(A)).all).toBe(0);
    await expect(svc.remove(A, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    tick();
    const back = await svc.restore(A, p.id);
    expect(back.id).toBe(p.id);
    await expect(svc.restore(A, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to restore after 30 days", async () => {
    const p = await svc.create(A);
    await svc.remove(A, p.id);
    clock = new Date(clock.getTime() + 31 * 24 * 3600 * 1000);
    await expect(svc.restore(A, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("duplicates title and brief into a fresh video", async () => {
    const p = await svc.create(A);
    await svc.patch(A, p.id, { rev: 0, title: "Tides", brief: { topic: "Tides" } });
    tick();
    const copy = await svc.duplicate(A, p.id);
    expect(copy).toMatchObject({ title: "Tides (copy)", brief: { topic: "Tides" }, rev: 0, status: "idea" });
    expect(copy.id).not.toBe(p.id);
    expect(copyTitle("x".repeat(120))).toHaveLength(120);
  });
});

describe("schemas", () => {
  it("validates list queries and patches", () => {
    expect(listQuery.parse({})).toEqual({ filter: "all", limit: 20, q: undefined });
    expect(listQuery.safeParse({ filter: "nope" }).success).toBe(false);
    expect(listQuery.safeParse({ limit: "51" }).success).toBe(false);
    expect(patchBody.safeParse({ rev: 0, title: "   " }).success).toBe(false);
    expect(patchBody.safeParse({ rev: 0, title: "x".repeat(121) }).success).toBe(false);
    expect(patchBody.safeParse({ rev: 0, status: "ready" }).success).toBe(false);
    expect(patchBody.parse({ rev: 2, title: "  Hi " })).toEqual({ rev: 2, title: "Hi" });
  });
});
