import "server-only";
import { randomBytes } from "node:crypto";
import { MetaError, type InstagramClient } from "./client";
import { seal, sign, verify } from "./crypto";
import type { InstagramRepo } from "./repo";
import { toStatus, type ConnectError, type InstagramStatus } from "./types";

/** The cookie that ties the Meta redirect back to the person who pressed Connect. */
export const STATE_COOKIE = "clipguru_ig_state";
export const STATE_MAX_AGE_SEC = 15 * 60;

type State = { n: string; u: string; r: string; t: number };

/**
 * Only paths inside the app. Parsed the way a browser would, so dot segments, encoded dots and
 * backslashes can't turn "/x/..//evil.test" into "//evil.test". Anything odd falls back to Settings.
 */
export function safeReturnTo(v: string | null | undefined): string {
  const fallback = "/settings";
  if (!v || v.length > 300 || !v.startsWith("/") || /[\\\s]/.test(v) || /%5c/i.test(v)) return fallback;
  let u: URL;
  try {
    u = new URL(v, "http://x");
  } catch {
    return fallback;
  }
  if (u.origin !== "http://x" || u.pathname.startsWith("//") || u.pathname.startsWith("/api/")) return fallback;
  return `${u.pathname}${u.search}${u.hash}`;
}

/** Adds ?instagram=… to an in-app path, keeping its other query values. */
export function withResult(returnTo: string, result: { ok: true } | { ok: false; reason: ConnectError }): string {
  const u = new URL(returnTo, "http://x");
  u.searchParams.delete("instagram");
  u.searchParams.delete("reason");
  u.searchParams.set("instagram", result.ok ? "connected" : "error");
  if (!result.ok) u.searchParams.set("reason", result.reason);
  const out = `${u.pathname}${u.search}${u.hash}`;
  return u.origin === "http://x" && out.startsWith("/") && !out.startsWith("//") ? out : "/settings";
}

type Deps = {
  repo: InstagramRepo;
  /** Null when Instagram isn't set up on this server. */
  client: () => InstagramClient | null;
  redirectUri: () => string;
  now?: () => Date;
};

/** Connecting and disconnecting Instagram (API Design → Account and Instagram). */
export function instagramService({ repo, client, redirectUri, now = () => new Date() }: Deps) {
  return {
    async status(userId: string): Promise<InstagramStatus> {
      return toStatus(await repo.get(userId), client() !== null, now());
    },

    /**
     * GET /api/instagram/connect: where to send the browser, and the signed cookie to set.
     * Null when Instagram isn't set up here.
     */
    start(userId: string, returnTo: string | null, scenario?: string): { url: string; cookie: string } | null {
      const c = client();
      if (!c) return null;
      const n = randomBytes(16).toString("base64url");
      const cookie = sign({ n, u: userId, r: safeReturnTo(returnTo), t: now().getTime() } satisfies State);
      return { url: c.loginUrl({ state: n, redirectUri: redirectUri(), scenario }), cookie };
    },

    /**
     * GET /api/instagram/callback: checks the state, swaps the code, reads the account and saves it.
     * Returns where to send the browser (with ?instagram=connected or =error&reason=…).
     */
    async finish(
      userId: string | null,
      cookie: string | undefined,
      q: { code?: string | null; state?: string | null; error?: string | null; errorReason?: string | null },
    ): Promise<string> {
      const st = verify<State>(cookie);
      const valid = st && userId && st.u === userId && q.state === st.n && now().getTime() - st.t < STATE_MAX_AGE_SEC * 1000;
      const back = st ? safeReturnTo(st.r) : "/settings";
      if (!valid) return withResult(back, { ok: false, reason: "UNKNOWN" });
      if (q.error || !q.code) {
        const cancelled = q.error === "access_denied" || q.errorReason === "user_denied";
        return withResult(back, { ok: false, reason: cancelled ? "CANCELLED" : "UNKNOWN" });
      }
      const c = client();
      if (!c) return withResult(back, { ok: false, reason: "UNKNOWN" });
      try {
        const token = await c.exchange(q.code, redirectUri());
        const { clientBusinessId, accounts } = await c.accounts(token.accessToken);
        const ig = accounts[0];
        // Unified Login only offers professional accounts, so none shared means a personal one (or none ticked).
        if (!ig) return withResult(back, { ok: false, reason: "PERSONAL_ACCOUNT" });
        const t = now();
        const prev = await repo.get(userId);
        const saved = await repo.save({
          userId,
          igUserId: ig.id,
          username: ig.username,
          avatarUrl: ig.avatarUrl,
          tokenEnc: seal(token.accessToken),
          tokenExpiresAt: token.expiresAt,
          clientBusinessId,
          reconnectNeeded: false,
          connectedAt: prev?.igUserId === ig.id ? prev.connectedAt : t,
          updatedAt: t,
        });
        if (!saved) return withResult(back, { ok: false, reason: "ACCOUNT_IN_USE" });
        return withResult(back, { ok: true });
      } catch (err) {
        console.error("[instagram] connect failed", err instanceof MetaError ? `${err.status} ${err.code} ${err.message}` : err);
        // 10 / 200-299: permission errors (not granted, or the app can't use it for this person).
        const perm = err instanceof MetaError && (err.code === 10 || (err.code !== undefined && err.code >= 200 && err.code < 300));
        return withResult(back, { ok: false, reason: perm ? "PERMISSION_DENIED" : "UNKNOWN" });
      }
    },

    /** DELETE /api/instagram. Scheduled posts get held here once they exist (F13). */
    async disconnect(userId: string): Promise<InstagramStatus> {
      await repo.delete(userId);
      return toStatus(null, client() !== null);
    },
  };
}
