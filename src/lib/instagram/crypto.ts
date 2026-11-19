import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { dbDriver, env } from "../env";

/**
 * Keys for Instagram tokens and the connect cookie, derived from BETTER_AUTH_SECRET so there is
 * no extra secret to set up. A local memory-database run without one uses a fixed test key.
 */
function key(purpose: string): Buffer {
  const secret = env().BETTER_AUTH_SECRET ?? (dbDriver() === "memory" ? "clipguru-local-test-secret-not-for-production" : null);
  if (!secret) throw new Error("BETTER_AUTH_SECRET is needed to store Instagram tokens.");
  return Buffer.from(hkdfSync("sha256", secret, "clipguru", purpose, 32));
}

const b64 = (b: Buffer) => b.toString("base64url");

/** AES-256-GCM: "v1.<iv>.<tag>.<ciphertext>". */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key("instagram-token"), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", b64(iv), b64(c.getAuthTag()), b64(ct)].join(".");
}

export function open(sealed: string): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unknown token format.");
  const d = createDecipheriv("aes-256-gcm", key("instagram-token"), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/** A value the browser carries but can't change: "<json, base64url>.<hmac>". */
export function sign(data: object): string {
  const body = b64(Buffer.from(JSON.stringify(data)));
  return `${body}.${b64(createHmac("sha256", key("instagram-state")).update(body).digest())}`;
}

export function verify<T>(signed: string | undefined | null): T | null {
  if (!signed) return null;
  const [body, mac] = signed.split(".");
  if (!body || !mac) return null;
  const want = createHmac("sha256", key("instagram-state")).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
