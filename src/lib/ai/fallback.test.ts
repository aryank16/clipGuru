import { APICallError, type LanguageModelV4 } from "@ai-sdk/provider";
import { describe, expect, it, vi } from "vitest";
import { withFallback } from "./fallback";

const busy = (status: number) =>
  new APICallError({ message: "high demand", url: "u", requestBodyValues: {}, statusCode: status, isRetryable: true });

function model(id: string, behaviour: () => Promise<unknown>): LanguageModelV4 {
  return {
    specificationVersion: "v4",
    provider: "google",
    modelId: id,
    supportedUrls: {},
    doGenerate: vi.fn(behaviour) as unknown as LanguageModelV4["doGenerate"],
    doStream: vi.fn(behaviour) as unknown as LanguageModelV4["doStream"],
  };
}

const opts = {} as Parameters<LanguageModelV4["doStream"]>[0];

describe("model fallback", () => {
  it("moves to the next model while one is busy", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = model("a", () => Promise.reject(busy(503)));
    const b = model("b", () => Promise.reject(busy(429)));
    const c = model("c", () => Promise.resolve("ok"));
    expect(await withFallback([a, b, c]).doStream(opts)).toBe("ok");
    expect(a.doStream).toHaveBeenCalledTimes(1);
    expect(b.doStream).toHaveBeenCalledTimes(1);
  });

  it("uses the first model when it answers, and passes other errors straight on", async () => {
    const a = model("a", () => Promise.resolve("first"));
    const b = model("b", () => Promise.resolve("second"));
    expect(await withFallback([a, b]).doGenerate(opts)).toBe("first");
    expect(b.doGenerate).not.toHaveBeenCalled();
    const bad = model("a", () => Promise.reject(busy(400)));
    await expect(withFallback([bad, b]).doGenerate(opts)).rejects.toMatchObject({ statusCode: 400 });
    expect(b.doGenerate).not.toHaveBeenCalled();
  });

  it("skips a backup model that no longer exists", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = model("a", () => Promise.reject(busy(503)));
    const gone = model("preview", () => Promise.reject(busy(404)));
    const c = model("c", () => Promise.resolve("ok"));
    expect(await withFallback([a, gone, c]).doStream(opts)).toBe("ok");
  });

  it("throws the last model's error when all are busy", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = model("a", () => Promise.reject(busy(503)));
    const b = model("b", () => Promise.reject(busy(503)));
    await expect(withFallback([a, b]).doStream(opts)).rejects.toMatchObject({ statusCode: 503 });
  });
});
