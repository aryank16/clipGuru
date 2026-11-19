import "server-only";
import { env } from "../env";

/** Meta's Graph API version used for login and Instagram calls. */
export const GRAPH_VERSION = "v27.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type IgAccount = { id: string; username: string; avatarUrl: string | null };

/** Thrown when Meta answers with an error; `code` is Meta's numeric error code when there is one. */
export class MetaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
  }
}

/** The calls F12 needs. Publishing (F13) adds to this. */
export interface InstagramClient {
  /** Where the Connect button sends the person (Facebook Login for Business with our configuration). */
  loginUrl(opts: { state: string; redirectUri: string; scenario?: string }): string;
  /** Swaps the code from the redirect for an access token. */
  exchange(code: string, redirectUri: string): Promise<{ accessToken: string; expiresAt: Date | null }>;
  /** The person's business id and the Instagram professional accounts they shared with the app. */
  accounts(accessToken: string): Promise<{ clientBusinessId: string | null; accounts: IgAccount[] }>;
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${GRAPH}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: number; error_subcode?: number } })
    | null;
  if (!res.ok || !data || data.error) {
    const e = data?.error;
    throw new MetaError(e?.message ?? `Meta answered ${res.status}`, res.status, e?.code, e?.error_subcode);
  }
  return data;
}

export function metaClient(): InstagramClient {
  const e = env();
  return {
    loginUrl({ state, redirectUri }) {
      const q = new URLSearchParams({
        client_id: e.META_APP_ID!,
        config_id: e.META_CONFIG_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        state,
      });
      return `https://www.facebook.com/dialog/oauth?${q}`;
    },

    async exchange(code, redirectUri) {
      let t = await graph<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
        client_id: e.META_APP_ID!,
        client_secret: e.META_APP_SECRET!,
        redirect_uri: redirectUri,
        code,
      });
      console.info("[instagram] token from code, expires_in:", t.expires_in ?? "none");
      // A configuration that hands out a short-lived user token (an hour or two): swap it for the
      // long-lived one (about 60 days). System-user tokens come without expiry and are kept as they are.
      if (t.expires_in && t.expires_in < 7 * 24 * 3600) {
        const long = await graph<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
          grant_type: "fb_exchange_token",
          client_id: e.META_APP_ID!,
          client_secret: e.META_APP_SECRET!,
          fb_exchange_token: t.access_token,
        }).catch((err) => {
          console.error("[instagram] long-lived token swap failed", err instanceof MetaError ? `${err.status} ${err.code} ${err.message}` : err);
          return null;
        });
        if (long) {
          console.info("[instagram] long-lived token, expires_in:", long.expires_in ?? "none");
          t = long;
        }
      }
      return {
        accessToken: t.access_token,
        expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : null,
      };
    },

    async accounts(accessToken) {
      const me = await graph<{ client_business_id?: string }>("/me", { fields: "client_business_id", access_token: accessToken }).catch(
        () => ({}) as { client_business_id?: string },
      );
      const list = await graph<{ data: { id: string; username?: string }[] }>("/me/assigned_instagram_accounts", {
        fields: "id,username",
        access_token: accessToken,
      });
      const accounts: IgAccount[] = [];
      for (const a of list.data ?? []) {
        // The picture is a nice-to-have: a failure here never stops the connection.
        const p = await graph<{ username?: string; profile_picture_url?: string }>(`/${a.id}`, {
          fields: "username,profile_picture_url",
          access_token: accessToken,
        }).catch(() => null);
        accounts.push({ id: a.id, username: a.username ?? p?.username ?? "instagram", avatarUrl: p?.profile_picture_url ?? null });
      }
      return { clientBusinessId: me.client_business_id ?? null, accounts };
    },
  };
}

/**
 * Local tests: the login "page" sends the browser straight back with a code. `scenario` picks
 * what Meta would have answered: ok (default), noaccount (a personal account), denied, other.
 */
export function fakeClient(): InstagramClient {
  return {
    loginUrl({ state, redirectUri, scenario }) {
      const q = new URLSearchParams({ state });
      if (scenario === "denied") {
        q.set("error", "access_denied");
        q.set("error_reason", "user_denied");
      } else q.set("code", `fake-${scenario ?? "ok"}`);
      return `${redirectUri}?${q}`;
    },
    async exchange(code) {
      if (code === "fake-broken") throw new MetaError("Invalid verification code format.", 400, 100);
      return { accessToken: `token-${code}-${Math.random().toString(36).slice(2)}`, expiresAt: null };
    },
    async accounts(token) {
      if (token.startsWith("token-fake-noaccount")) return { clientBusinessId: "biz-1", accounts: [] };
      const other = token.startsWith("token-fake-other");
      return {
        clientBusinessId: "biz-1",
        accounts: [
          other
            ? { id: "17841400000000002", username: "clipguru.second", avatarUrl: null }
            : { id: "17841400000000001", username: "clipguru.test", avatarUrl: null },
        ],
      };
    },
  };
}
