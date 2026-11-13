import { describe, expect, it } from "vitest";
import { clock, relativeTime } from "./time";

const now = new Date("2026-11-13T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("relativeTime", () => {
  it("reads like the design", () => {
    expect(relativeTime(ago(10_000), now)).toBe("just now");
    expect(relativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(relativeTime(ago(2 * 3600_000), now)).toBe("2h ago");
    expect(relativeTime(ago(30 * 3600_000), now)).toBe("yesterday");
    expect(relativeTime(ago(3 * 86400_000), now)).toBe("3 days ago");
    expect(relativeTime("2026-11-04T12:00:00Z", now)).toBe("4 Nov");
    expect(relativeTime("2025-10-24T12:00:00Z", now)).toBe("24 Oct 2025");
  });
  it("formats durations", () => {
    expect(clock(74)).toBe("01:14");
    expect(clock(0)).toBe("00:00");
  });
});
