import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real Better Auth sign-in flow, with Google's token endpoint faked: proves that "Continue with Google"
// signs into an existing password account with the same email, and what happens to that password.
const APP = "http://localhost:3000";
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const idToken = (email: string, verified = true) =>
  `${b64({ alg: "RS256", kid: "k" })}.${b64({ sub: `g-${email}`, email, email_verified: verified, name: "Pat", iss: "https://accounts.google.com", aud: "test-client" })}.sig`;

async function setup() {
  vi.resetModules();
  vi.stubEnv("DB_DRIVER", "memory");
  vi.stubEnv("AI_DRIVER", "fake");
  vi.stubEnv("APP_URL", APP);
  vi.stubEnv("BETTER_AUTH_URL", APP);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-1234");
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
  const { auth } = await import("./auth");
  return auth();
}

function cookiesFrom(res: Response): string {
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function googleSignIn(a: Awaited<ReturnType<typeof setup>>, email: string, verified = true) {
  const start = await a.handler(
    new Request(`${APP}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP },
      body: JSON.stringify({ provider: "google", callbackURL: "/videos", errorCallbackURL: "/sign-in" }),
    }),
  );
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state")!;
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (u.includes("oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "at", id_token: idToken(email, verified), expires_in: 3600, token_type: "Bearer", scope: "openid email profile" });
    }
    return realFetch(input, init);
  });
  return a.handler(new Request(`${APP}/api/auth/callback/google?code=c&state=${state}`, { headers: { cookie: cookiesFrom(start) } }));
}

// The first test loads Better Auth cold, which can pass the default 5 s on a busy machine.
describe("Continue with Google on an existing password account", { timeout: 30_000 }, () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("signs straight in, and removes a password whose email was never confirmed", async () => {
    const a = await setup();
    await a.api.signUpEmail({ body: { name: "Pat", email: "pat@example.com", password: "Str0ng!passw0rd" } });
    const res = await googleSignIn(a, "pat@example.com");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/videos");
    expect(cookiesFrom(res)).toMatch(/session_token=/);

    const ctx = await a.$context;
    const found = await ctx.internalAdapter.findUserByEmail("pat@example.com", { includeAccounts: true });
    expect(found?.user.emailVerified).toBe(true);
    expect(found?.accounts.map((x) => x.providerId)).toEqual(["google"]);
    await expect(a.api.signInEmail({ body: { email: "pat@example.com", password: "Str0ng!passw0rd" } })).rejects.toThrow();
  });

  it("refuses a Google account whose email Google hasn't confirmed, and keeps the password", async () => {
    const a = await setup();
    await a.api.signUpEmail({ body: { name: "Vic", email: "vic@example.com", password: "Str0ng!passw0rd" } });
    const res = await googleSignIn(a, "vic@example.com", false);
    expect(res.headers.get("location")).toBe("/sign-in?error=account_not_linked");
    const ctx = await a.$context;
    const found = await ctx.internalAdapter.findUserByEmail("vic@example.com", { includeAccounts: true });
    expect(found?.accounts.map((x) => x.providerId)).toEqual(["credential"]);
    expect(await a.api.signInEmail({ body: { email: "vic@example.com", password: "Str0ng!passw0rd" } })).toBeTruthy();
  });

  it("keeps the password when the email was already confirmed", async () => {
    const a = await setup();
    await a.api.signUpEmail({ body: { name: "Sam", email: "sam@example.com", password: "Str0ng!passw0rd" } });
    const ctx = await a.$context;
    const u = await ctx.internalAdapter.findUserByEmail("sam@example.com");
    await ctx.internalAdapter.updateUser(u!.user.id, { emailVerified: true });
    const res = await googleSignIn(a, "sam@example.com");
    expect(res.headers.get("location")).toBe("/videos");
    const found = await ctx.internalAdapter.findUserByEmail("sam@example.com", { includeAccounts: true });
    expect(found?.accounts.map((x) => x.providerId).sort()).toEqual(["credential", "google"]);
    expect(await a.api.signInEmail({ body: { email: "sam@example.com", password: "Str0ng!passw0rd" } })).toBeTruthy();
  });
});
