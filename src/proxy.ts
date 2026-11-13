import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { canonicalRedirect } from "@/lib/canonical";
import { env } from "@/lib/env";

/** Pages a signed-out visitor may open. Everything else in the app needs a session. */
const AUTH_PAGES = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password"];

/**
 * Fast, optimistic gate: checks only that a session cookie exists.
 * Pages and API routes still verify the session itself on the server.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // On Vercel, keep everyone on the app's main address (see canonicalRedirect).
  if (process.env.VERCEL === "1") {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const target = canonicalRedirect(host, pathname + search, env().APP_URL);
    if (target) return new NextResponse(null, { status: 308, headers: { Location: target } });
  }
  const hasSession = Boolean(getSessionCookie(request));
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isAuthPage) {
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (hasSession && isAuthPage && pathname !== "/reset-password") {
    return NextResponse.redirect(new URL("/videos", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes (they answer 401 themselves), Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\\.[a-z0-9]+$).*)"],
};
