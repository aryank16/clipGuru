import { afterEach, describe, expect, it, vi } from "vitest";

describe("env", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reads a key pasted more than once, or with line breaks, as the key", async () => {
    vi.resetModules();
    vi.stubEnv("R2_ACCESS_KEY_ID", "abc123\n\nabc123\n\nabc123");
    vi.stubEnv("ELEVENLABS_API_KEY", "  sk_test  ");
    const { env } = await import("./env");
    expect(env().R2_ACCESS_KEY_ID).toBe("abc123");
    expect(env().ELEVENLABS_API_KEY).toBe("sk_test");
    expect(env().R2_BUCKET).toBe("clipguru-media");
  });

  it("uses the test voice only when asked for, and never on production", async () => {
    const driver = async (vars: Record<string, string>) => {
      vi.resetModules();
      vi.unstubAllEnvs();
      vi.stubEnv("AI_DRIVER", "gemini");
      vi.stubEnv("ELEVENLABS_API_KEY", "sk_test");
      for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
      return (await import("./env")).voiceDriver();
    };
    expect(await driver({})).toBe("elevenlabs");
    expect(await driver({ VOICE_DRIVER: "test", VERCEL_ENV: "preview" })).toBe("test");
    expect(await driver({ VOICE_DRIVER: "test", VERCEL_ENV: "production" })).toBe("elevenlabs");
  });

  it("limits videos per month to 10 unless set", async () => {
    vi.resetModules();
    expect((await import("./env")).env().VIDEOS_PER_MONTH).toBe(10);
    vi.resetModules();
    vi.stubEnv("VIDEOS_PER_MONTH", "0");
    expect((await import("./env")).env().VIDEOS_PER_MONTH).toBe(0);
  });
});
