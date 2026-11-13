import { env } from "./env";

/**
 * Origins allowed to call the auth API: APP_URL, every address Vercel gives this deployment,
 * and the host the request came in on. A browser always sends the page's real Origin, so a
 * page on the same host is same-origin and safe; other sites still get INVALID_ORIGIN.
 */
export function trustedOrigins(headers?: Headers): string[] {
  const v = process.env;
  const hosts = [v.VERCEL_URL, v.VERCEL_BRANCH_URL, v.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean);
  const origins = new Set([new URL(env().APP_URL).origin, ...hosts.map((h) => `https://${h}`)]);
  const own = requestOrigin(headers);
  if (own) origins.add(own);
  return [...origins];
}

/** The origin the browser used, from the proxy headers Vercel sets (or Host locally). */
function requestOrigin(headers?: Headers): string | null {
  const host = headers?.get("x-forwarded-host")?.split(",")[0].trim() || headers?.get("host");
  if (!host) return null;
  const proto = headers?.get("x-forwarded-proto")?.split(",")[0].trim() || (isLocal(host) ? "http" : "https");
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}

function isLocal(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}
