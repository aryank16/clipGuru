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
});
