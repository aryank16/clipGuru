/**
 * On Vercel one deployment answers on several addresses (the main domain, the branch URL and a
 * one-off URL per deploy). Google sign-in needs the visitor to start and finish on the same address,
 * so every page request on another address is sent to APP_URL's host with the same path.
 * Returns the URL to redirect to, or null to carry on.
 */
export function canonicalRedirect(requestHost: string | null, path: string, appUrl: string): string | null {
  if (!requestHost) return null;
  const canonical = new URL(appUrl);
  if (requestHost.toLowerCase() === canonical.host.toLowerCase()) return null;
  return new URL(path, canonical.origin).toString();
}
