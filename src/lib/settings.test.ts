import { describe, expect, it } from "vitest";
import { VOICE_ALICE, VOICE_GEORGE } from "./defaults";
import { deleteMeBody, patchMeBody, toMe } from "./me";
import { memoryProjects, resetMemoryProjects } from "./projects/memory";
import { projectService } from "./projects/service";
import { timeZoneOptions } from "./timezones";
import { isVoiceId, VOICES, voiceLabel } from "./voices";

describe("PATCH /api/me body", () => {
  it("accepts known values and trims names", () => {
    expect(patchMeBody.parse({ name: "  Aryan ", timeZone: "Europe/Berlin", defaultVoiceId: VOICE_ALICE })).toEqual({
      name: "Aryan",
      timeZone: "Europe/Berlin",
      defaultVoiceId: VOICE_ALICE,
    });
    expect(patchMeBody.parse({ onboarded: true })).toEqual({ onboarded: true });
  });
  it("rejects unknown zones, voices, empty names and extra fields", () => {
    expect(patchMeBody.safeParse({ timeZone: "Mars/Olympus" }).success).toBe(false);
    expect(patchMeBody.safeParse({ defaultVoiceId: "nope" }).success).toBe(false);
    expect(patchMeBody.safeParse({ name: "   " }).success).toBe(false);
    expect(patchMeBody.safeParse({ email: "x@y.z" }).success).toBe(false);
    expect(patchMeBody.safeParse({ onboarded: false }).success).toBe(false);
  });
  it("needs the exact word to delete", () => {
    expect(deleteMeBody.safeParse({ confirm: "DELETE" }).success).toBe(true);
    expect(deleteMeBody.safeParse({ confirm: "delete" }).success).toBe(false);
    expect(deleteMeBody.safeParse({}).success).toBe(false);
  });
});

describe("user shape", () => {
  it("maps onboardedAt to a flag and fills defaults", () => {
    expect(toMe({ id: "u", name: "A", email: "a@b.c" })).toMatchObject({ timeZone: "Europe/London", onboarded: false });
    expect(toMe({ id: "u", name: "A", email: "a@b.c", onboardedAt: new Date() }).onboarded).toBe(true);
  });
});

describe("voices", () => {
  it("lists George first as the default, with previews", () => {
    expect(VOICES[0]).toMatchObject({ id: VOICE_GEORGE, name: "George", default: true });
    expect(VOICES.every((v) => v.previewUrl.startsWith("/voices/"))).toBe(true);
    expect(isVoiceId(VOICE_ALICE)).toBe(true);
    expect(voiceLabel(VOICE_ALICE)).toBe("Alice (British female)");
    expect(voiceLabel(undefined)).toBe("George (British male)");
  });
});

describe("time zones", () => {
  it("labels zones with their offset and keeps the current one", () => {
    const winter = new Date("2026-01-15T12:00:00Z");
    const opts = timeZoneOptions("Europe/Berlin", winter);
    expect(opts.find((o) => o.id === "Europe/Berlin")?.label).toBe("Europe/Berlin (UTC+01:00)");
    expect(opts.find((o) => o.id === "Asia/Tokyo")?.label).toBe("Asia/Tokyo (UTC+09:00)");
    expect(opts.some((o) => o.id === "UTC")).toBe(true);
    expect(timeZoneOptions("UTC", winter).find((o) => o.id === "UTC")?.label).toBe("UTC (UTC+00:00)");
  });
});

describe("account deletion", () => {
  it("removes only that user's videos", async () => {
    resetMemoryProjects();
    const svc = projectService(memoryProjects);
    await svc.create("a");
    await svc.create("a");
    await svc.create("b");
    expect(await memoryProjects.deleteAllForUser("a")).toBe(2);
    expect((await memoryProjects.counts("a")).all).toBe(0);
    expect((await memoryProjects.counts("b")).all).toBe(1);
  });
});
