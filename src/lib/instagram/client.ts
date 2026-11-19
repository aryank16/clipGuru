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

/** Meta's processing state of an uploaded Reel (the media container). */
export type ContainerStatus = { status: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED"; message: string | null };

export type ReelInput = { videoUrl: string; caption: string; thumbOffsetMs: number };

/** Connecting (F12) and publishing Reels (F13). */
export interface InstagramClient {
  /** Where the Connect button sends the person (Facebook Login for Business with our configuration). */
  loginUrl(opts: { state: string; redirectUri: string; scenario?: string }): string;
  /** Swaps the code from the redirect for an access token. */
  exchange(code: string, redirectUri: string): Promise<{ accessToken: string; expiresAt: Date | null }>;
  /** The person's business id and the Instagram professional accounts they shared with the app. */
  accounts(accessToken: string): Promise<{ clientBusinessId: string | null; accounts: IgAccount[] }>;
  /** Hands Meta the video to fetch and process. Returns the container id. */
  createReel(accessToken: string, igUserId: string, reel: ReelInput): Promise<string>;
  containerStatus(accessToken: string, containerId: string): Promise<ContainerStatus>;
  /** Publishes a processed container. Returns the new media id. */
  publish(accessToken: string, igUserId: string, containerId: string): Promise<string>;
  permalink(accessToken: string, mediaId: string): Promise<string | null>;
}

async function graph<T>(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET"): Promise<T> {
  // POST sends the values in the body, so the token and caption stay out of any logged URL.
  const res =
    method === "GET"
      ? await fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) })
      : await fetch(`${GRAPH}${path}`, {
          method: "POST",
          body: new URLSearchParams(params),
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        });
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

    async createReel(accessToken, igUserId, { videoUrl, caption, thumbOffsetMs }) {
      const r = await graph<{ id: string }>(
        `/${igUserId}/media`,
        {
          media_type: "REELS",
          video_url: videoUrl,
          caption,
          share_to_feed: "true",
          thumb_offset: String(Math.max(0, Math.round(thumbOffsetMs))),
          access_token: accessToken,
        },
        "POST",
      );
      return r.id;
    },

    async containerStatus(accessToken, containerId) {
      const r = await graph<{ status_code?: ContainerStatus["status"]; status?: string }>(`/${containerId}`, {
        fields: "status_code,status",
        access_token: accessToken,
      });
      return { status: r.status_code ?? "IN_PROGRESS", message: r.status ?? null };
    },

    async publish(accessToken, igUserId, containerId) {
      const r = await graph<{ id: string }>(
        `/${igUserId}/media_publish`,
        { creation_id: containerId, access_token: accessToken },
        "POST",
      );
      return r.id;
    },

    async permalink(accessToken, mediaId) {
      const r = await graph<{ permalink?: string }>(`/${mediaId}`, { fields: "permalink", access_token: accessToken }).catch(
        () => null,
      );
      return r?.permalink ?? null;
    },
  };
}

const g = globalThis as unknown as { __fakeContainers?: Map<string, { caption: string; polls: number; published?: boolean }> };
const fakeContainers = (g.__fakeContainers ??= new Map());

/**
 * Local tests: the login "page" sends the browser straight back with a code. `scenario` picks
 * what Meta would have answered: ok (default), noaccount (a personal account), denied, other.
 * Publishing: a caption containing FAKE_REJECT fails processing, FAKE_LIMIT hits the daily limit,
 * FAKE_TOKEN has the token refused, FAKE_DOWN is an outage; anything else posts after one check.
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
    async createReel(_token, _ig, { caption }) {
      if (caption.includes("FAKE_TOKEN")) throw new MetaError("Error validating access token.", 400, 190);
      if (caption.includes("FAKE_LIMIT")) throw new MetaError("Application request limit reached", 400, 9, 2207042);
      if (caption.includes("FAKE_DOWN")) throw new MetaError("Service temporarily unavailable", 503, 2);
      const id = `fake-container-${Math.random().toString(36).slice(2)}`;
      fakeContainers.set(id, { caption, polls: 0 });
      return id;
    },
    async containerStatus(_token, id) {
      const c = fakeContainers.get(id);
      if (!c) return { status: "EXPIRED", message: null };
      if (c.published) return { status: "PUBLISHED", message: null };
      c.polls++;
      if (c.caption.includes("FAKE_REJECT")) return { status: "ERROR", message: "Error: video format not supported" };
      return { status: c.polls > 1 ? "FINISHED" : "IN_PROGRESS", message: null };
    },
    async publish(_token, _ig, id) {
      const c = fakeContainers.get(id);
      if (!c || c.published) throw new MetaError("The media has already been published.", 400, 9007, 2207008);
      c.published = true;
      return `fake-media-${id.slice(-6)}`;
    },
    async permalink(_token, mediaId) {
      return `https://www.instagram.com/reel/${mediaId}/`;
    },
  };
}
