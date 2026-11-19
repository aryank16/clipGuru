import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DB_DRIVER = "memory";
process.env.AI_DRIVER = "fake";

let svcMod: typeof import("./service");
let client: typeof import("./client");
let crypto: typeof import("./crypto");
let repo: typeof import("./repo");
let types: typeof import("./types");

beforeAll(async () => {
  svcMod = await import("./service");
  client = await import("./client");
  crypto = await import("./crypto");
  repo = await import("./repo");
  types = await import("./types");
});
beforeEach(() => repo.resetMemoryInstagram());

const A = "user-a";
const B = "user-b";
const REDIRECT = "https://app.test/api/instagram/callback";

function service(over: { client?: import("./client").InstagramClient | null; now?: () => Date } = {}) {
  const c = over.client === undefined ? client.fakeClient() : over.client;
  return svcMod.instagramService({ repo: repo.memoryInstagram, client: () => c, redirectUri: () => REDIRECT, now: over.now });
}

/** Runs the whole flow the way the browser would: start, follow the fake login, finish. */
async function connect(userId: string, scenario?: string, s = service()) {
  const started = s.start(userId, "/settings", scenario)!;
  const back = new URL(started.url);
  return s.finish(userId, started.cookie, {
    code: back.searchParams.get("code"),
    state: back.searchParams.get("state"),
    error: back.searchParams.get("error"),
    errorReason: back.searchParams.get("error_reason"),
  });
}

describe("instagram connect", () => {
  it("links the shared account, stores the token encrypted, and reports it connected", async () => {
    await expect(connect(A)).resolves.toBe("/settings?instagram=connected");
    const r = await repo.memoryInstagram.get(A);
    expect(r).toMatchObject({ igUserId: "17841400000000001", username: "clipguru.test", reconnectNeeded: false });
    expect(r!.tokenEnc).not.toContain("token-");
    expect(crypto.open(r!.tokenEnc)).toMatch(/^token-fake-ok-/);
    await expect(service().status(A)).resolves.toEqual({ connected: true, username: "clipguru.test", avatarUrl: null, status: "connected" });
  });

  it("explains a personal account, a cancel, a permission error and a broken exchange", async () => {
    await expect(connect(A, "noaccount")).resolves.toBe("/settings?instagram=error&reason=PERSONAL_ACCOUNT");
    await expect(connect(A, "denied")).resolves.toBe("/settings?instagram=error&reason=CANCELLED");
    await expect(connect(A, "broken")).resolves.toBe("/settings?instagram=error&reason=UNKNOWN");
    const perm = { ...client.fakeClient(), exchange: async () => { throw new client.MetaError("no", 403, 200); } };
    await expect(connect(A, undefined, service({ client: perm }))).resolves.toBe("/settings?instagram=error&reason=PERMISSION_DENIED");
    expect(await repo.memoryInstagram.get(A)).toBeNull();
  });

  it("refuses a state that is missing, forged, someone else's or stale", async () => {
    const s = service();
    const started = s.start(A, "/settings")!;
    const code = "fake-ok";
    const state = new URL(started.url).searchParams.get("state");
    const bad = "/settings?instagram=error&reason=UNKNOWN";
    await expect(s.finish(A, undefined, { code, state })).resolves.toBe(bad);
    await expect(s.finish(A, started.cookie, { code, state: "other" })).resolves.toBe(bad);
    await expect(s.finish(B, started.cookie, { code, state })).resolves.toBe(bad);
    await expect(s.finish(A, started.cookie.replace(/.$/, "x"), { code, state })).resolves.toBe(bad);
    const later = service({ now: () => new Date(Date.now() + 16 * 60_000) });
    await expect(later.finish(A, started.cookie, { code, state })).resolves.toBe(bad);
    expect(await repo.memoryInstagram.get(A)).toBeNull();
    await expect(s.finish(A, started.cookie, { code, state })).resolves.toBe("/settings?instagram=connected");
  });

  it("allows one person per Instagram account, and replaces a person's own account", async () => {
    await connect(A);
    await expect(connect(B)).resolves.toBe("/settings?instagram=error&reason=ACCOUNT_IN_USE");
    await expect(connect(A, "other")).resolves.toBe("/settings?instagram=connected");
    expect((await repo.memoryInstagram.get(A))?.username).toBe("clipguru.second");
    await expect(connect(B)).resolves.toBe("/settings?instagram=connected");
  });

  it("disconnects, and says when it isn't set up here", async () => {
    await connect(A);
    await expect(service().disconnect(A)).resolves.toEqual({ connected: false, available: true });
    expect(await repo.memoryInstagram.get(A)).toBeNull();
    const off = service({ client: null });
    expect(off.start(A, "/settings")).toBeNull();
    await expect(off.status(A)).resolves.toEqual({ connected: false, available: false });
  });

  it("asks to reconnect when the token expired or Meta refused it", async () => {
    await connect(A);
    const r = (await repo.memoryInstagram.get(A))!;
    expect(types.toStatus({ ...r, tokenExpiresAt: new Date(Date.now() - 1000) }, true)).toMatchObject({ status: "reconnect_needed" });
    await repo.memoryInstagram.markReconnectNeeded(A, new Date());
    await expect(service().status(A)).resolves.toMatchObject({ status: "reconnect_needed" });
  });
});

describe("instagram helpers", () => {
  it("only returns to paths inside the app", () => {
    const bad = [
      null, "", "https://evil.test", "//evil.test", "/\\evil.test", "/api/instagram/connect",
      "/.//evil.test", "/x/..//evil.test", "/%2e//evil.test", "/%2E%2E//evil.test", "/x/%2e%2e//evil.test",
      "/.\\/evil.test", "/%5c/evil.test", "/ /evil.test", "/x/../api/instagram", "/\t/evil.test",
    ];
    for (const v of bad) {
      expect(svcMod.safeReturnTo(v), String(v)).toBe("/settings");
      expect(svcMod.withResult(svcMod.safeReturnTo(v), { ok: true })).toMatch(/^\/(?!\/)/);
    }
    expect(svcMod.withResult("//evil.test/x", { ok: true })).toBe("/settings");
    expect(svcMod.safeReturnTo("/videos/./abc")).toBe("/videos/abc");
    expect(svcMod.safeReturnTo("/videos/abc/post?x=1")).toBe("/videos/abc/post?x=1");
    expect(svcMod.withResult("/videos/abc/post?x=1&instagram=error&reason=CANCELLED", { ok: true })).toBe("/videos/abc/post?x=1&instagram=connected");
  });

  it("seals tokens so they can't be read or changed", () => {
    const s = crypto.seal("secret-token");
    expect(s).not.toContain("secret");
    expect(crypto.seal("secret-token")).not.toBe(s);
    expect(crypto.open(s)).toBe("secret-token");
    const [v, iv, tag, ct] = s.split(".");
    const flipped = [v, iv, tag, (ct[0] === "A" ? "B" : "A") + ct.slice(1)].join(".");
    expect(() => crypto.open(flipped)).toThrow();
    expect(crypto.verify(crypto.sign({ a: 1 }))).toEqual({ a: 1 });
    expect(crypto.verify("e30.bad")).toBeNull();
  });

  it("builds Meta's login link with the configuration and state", () => {
    process.env.META_APP_ID = "123";
    process.env.META_APP_SECRET = "s";
    process.env.META_CONFIG_ID = "456";
    vi.resetModules();
    return import("./client").then((m) => {
      const u = new URL(m.metaClient().loginUrl({ state: "st", redirectUri: REDIRECT }));
      expect(u.origin + u.pathname).toBe("https://www.facebook.com/dialog/oauth");
      expect(Object.fromEntries(u.searchParams)).toEqual({ client_id: "123", config_id: "456", redirect_uri: REDIRECT, response_type: "code", state: "st" });
      delete process.env.META_APP_ID;
      delete process.env.META_APP_SECRET;
      delete process.env.META_CONFIG_ID;
    });
  });
});
