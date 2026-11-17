import "server-only";
import { AwsClient } from "aws4fetch";
import { ApiError } from "./api/errors";
import { env, storageDriver } from "./env";

/**
 * Private file storage (Database Design → Files and data lifecycle). Keys sit under
 * `users/{userId}/…`, so deleting a user is one prefix delete.
 */
export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** A short-lived link the browser can fetch the file from. */
  signedUrl(key: string, seconds?: number): Promise<string>;
  /**
   * A link that lets someone else upload one file (the render sandbox sends the MP4 straight to R2).
   * Null for the memory store, which only takes bytes through put().
   */
  signedPutUrl(key: string, seconds?: number): Promise<string | null>;
  /** Only the memory store can hand bytes back (R2 files are fetched through signed links). */
  read?(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  deletePrefix(prefix: string): Promise<number>;
}

// ── Cloudflare R2 (S3 API) ───────────────────────────────────────────────────

function r2(): Storage {
  const e = env();
  const client = new AwsClient({
    accessKeyId: e.R2_ACCESS_KEY_ID!,
    secretAccessKey: e.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
  const base = `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(e.R2_BUCKET)}`;
  const url = (key: string) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const check = async (res: Response, what: string) => {
    if (!res.ok) throw new Error(`R2 ${what} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  };

  return {
    async put(key, body, contentType) {
      // R2 refuses uploads without Content-Length. A signed Request object can reach fetch as a
      // stream (no length) on Vercel, so sign first and send the plain bytes ourselves.
      const bytes = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
      const signed = await client.sign(url(key), {
        method: "PUT",
        body: bytes,
        headers: { "content-type": contentType, "content-length": String(bytes.byteLength) },
      });
      const res = await fetch(signed.url, {
        method: "PUT",
        headers: signed.headers,
        body: bytes,
        cache: "no-store",
      });
      await check(res, "upload");
    },

    async signedUrl(key, seconds = 24 * 3600) {
      const signed = await client.sign(new Request(`${url(key)}?X-Amz-Expires=${seconds}`), {
        aws: { signQuery: true },
      });
      return signed.url;
    },

    async signedPutUrl(key, seconds = 3600) {
      const signed = await client.sign(new Request(`${url(key)}?X-Amz-Expires=${seconds}`, { method: "PUT" }), {
        aws: { signQuery: true },
      });
      return signed.url;
    },

    async deletePrefix(prefix) {
      let n = 0;
      for (let round = 0; round < 50; round++) {
        const res = await client.fetch(`${base}?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`);
        await check(res, "list");
        const keys = [...(await res.text()).matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => decodeXml(m[1]));
        if (!keys.length) break;
        for (const key of keys) {
          await check(await client.fetch(url(key), { method: "DELETE" }), "delete");
          n++;
        }
      }
      return n;
    },
  };
}

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// ── Memory (DB_DRIVER=memory) ────────────────────────────────────────────────

const g = globalThis as unknown as { __memoryFiles?: Map<string, { body: Uint8Array; contentType: string }> };
const files = (g.__memoryFiles ??= new Map());

export const memoryStorage: Storage = {
  async put(key, body, contentType) {
    files.set(key, { body: new Uint8Array(body), contentType });
  },
  async signedUrl(key) {
    return `memory://${key}`;
  },
  async signedPutUrl() {
    return null;
  },
  async read(key) {
    return files.get(key) ?? null;
  },
  async deletePrefix(prefix) {
    let n = 0;
    for (const key of [...files.keys()]) if (key.startsWith(prefix) && files.delete(key)) n++;
    return n;
  },
};

export function resetMemoryStorage() {
  files.clear();
}

/** The configured store; 503 VOICE_UNAVAILABLE when R2 isn't set up yet. */
export function storage(): Storage {
  const d = storageDriver();
  if (d === "r2") return r2();
  if (d === "memory") return memoryStorage;
  throw new ApiError("VOICE_UNAVAILABLE", "File storage isn't set up yet, so the voiceover can't be saved.", {
    reason: "not_configured",
  });
}

/** For cleanup paths that must not fail when storage was never set up. */
export function storageIfConfigured(): Storage | null {
  return storageDriver() ? storage() : null;
}

export const userPrefix = (userId: string) => `users/${userId}/`;
