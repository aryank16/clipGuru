import { describe, expect, it } from "vitest";
import { addDays, groupPosts, mondayOf, weekDays } from "./schedule-view";
import type { Post, PostStatus } from "./types";

const now = new Date("2026-11-20T12:00:00Z");
let n = 0;
function post(status: PostStatus, at: string, postedAt: string | null = null): Post {
  n++;
  return {
    id: `p${n}`,
    projectId: `v${n}`,
    renderId: `r${n}`,
    thumbnailUrl: "",
    caption: "",
    hashtags: [],
    coverOffsetMs: 0,
    mode: "scheduled",
    scheduledAt: at,
    timeZone: null,
    status,
    igUsername: "me",
    permalink: null,
    error: null,
    editableUntil: null,
    postedAt,
    createdAt: at,
  };
}

describe("Scheduled page groups", () => {
  it("sorts upcoming soonest first, recent and attention newest first, and drops cancelled and old", () => {
    const later = post("scheduled", "2026-11-25T10:00:00Z");
    const sooner = post("scheduled", "2026-11-21T10:00:00Z");
    const sending = post("publishing", "2026-11-20T11:59:00Z");
    const old = post("posted", "2026-10-01T10:00:00Z", "2026-10-01T10:00:00Z");
    const posted1 = post("posted", "2026-11-10T10:00:00Z", "2026-11-10T10:01:00Z");
    const posted2 = post("posted", "2026-11-18T10:00:00Z", "2026-11-18T10:01:00Z");
    const failed = post("failed", "2026-11-19T10:00:00Z");
    const held = post("held", "2026-11-22T10:00:00Z");
    const cancelled = post("cancelled", "2026-11-23T10:00:00Z");
    const g = groupPosts([later, sooner, sending, old, posted1, posted2, failed, held, cancelled], now);
    expect(g.upcoming.map((p) => p.id)).toEqual([sending.id, sooner.id, later.id]);
    expect(g.recent.map((p) => p.id)).toEqual([posted2.id, posted1.id]);
    expect(g.attention.map((p) => p.id)).toEqual([held.id, failed.id]);
  });
});

describe("week strip", () => {
  it("finds the Monday and counts posts per day in the person's zone", () => {
    expect(mondayOf("2026-11-20")).toBe("2026-11-16");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    // 23:30 UTC on Fri 20 Nov is already Sat 21 Nov in Berlin.
    const late = post("scheduled", "2026-11-20T23:30:00Z");
    const done = post("posted", "2026-11-17T08:00:00Z", "2026-11-17T08:00:30Z");
    const days = weekDays("2026-11-16", [late, done], "Europe/Berlin", now);
    expect(days.map((d) => d.day)).toEqual([16, 17, 18, 19, 20, 21, 22]);
    expect(days.find((d) => d.isToday)?.date).toBe("2026-11-20");
    expect(days[5]).toMatchObject({ weekday: "Sat", scheduled: 1, posted: 0 });
    expect(days[1]).toMatchObject({ weekday: "Tue", scheduled: 0, posted: 1 });
  });
});
