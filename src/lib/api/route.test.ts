import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "./errors";
import { json, parseBody, parseQuery, route } from "./route";
import { decodeCursor, encodeCursor } from "./pagination";

const noCtx = {} as never;

describe("route()", () => {
  it("adds request id and no-store headers", async () => {
    const handler = route(async () => json({ ok: true }));
    const res = await handler(new Request("http://localhost/api/x"), noCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toMatch(/[0-9a-f-]{36}/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("maps ApiError to the standard error body", async () => {
    const handler = route(async () => {
      throw new ApiError("REV_CONFLICT", undefined, { currentRev: 14 });
    });
    const res = await handler(new Request("http://localhost/api/x"), noCtx);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "REV_CONFLICT", message: "This changed in another tab.", details: { currentRev: 14 } },
    });
  });

  it("hides unknown errors behind 500 INTERNAL", async () => {
    const handler = route(async () => {
      throw new Error("db exploded");
    });
    const res = await handler(new Request("http://localhost/api/x"), noCtx);
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL");
  });

  it("rejects cross-origin writes", async () => {
    const handler = route(async () => json({ ok: true }));
    const req = new Request("http://localhost/api/x", { method: "POST", headers: { origin: "https://evil.example" } });
    const res = await handler(req, noCtx);
    expect(res.status).toBe(403);
  });

  it("allows same-origin writes", async () => {
    const handler = route(async () => json({ ok: true }, 201));
    const req = new Request("http://localhost/api/x", { method: "POST", headers: { origin: "http://localhost" } });
    const res = await handler(req, noCtx);
    expect(res.status).toBe(201);
  });
});

describe("validation", () => {
  const schema = z.object({ title: z.string().min(1).max(120) });

  it("returns per-field details", async () => {
    const req = new Request("http://localhost/api/x", { method: "POST", body: JSON.stringify({ title: "" }) });
    const err = await parseBody(req, schema).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(err.details)).toEqual(["title"]);
  });

  it("rejects malformed JSON", async () => {
    const req = new Request("http://localhost/api/x", { method: "POST", body: "{nope" });
    await expect(parseBody(req, schema)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("parses query strings", () => {
    const q = parseQuery(
      new Request("http://localhost/api/projects?limit=5"),
      z.object({ limit: z.coerce.number().int().min(1).max(50) }),
    );
    expect(q.limit).toBe(5);
  });
});

describe("cursor", () => {
  it("round-trips and rejects garbage", () => {
    const c = encodeCursor({ u: "2026-11-09T20:58:00.000Z", i: "6730a1" });
    expect(decodeCursor(c)).toEqual({ u: "2026-11-09T20:58:00.000Z", i: "6730a1" });
    expect(() => decodeCursor("!!!")).toThrow(ApiError);
  });
});
