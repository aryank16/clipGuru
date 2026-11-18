import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { auth } from "@/lib/auth";
import { instagramSvc } from "@/lib/instagram";
import { STATE_COOKIE } from "@/lib/instagram/service";

/** GET /api/instagram/callback — Meta sends the browser back here with a code (or an error). */
export const GET = route(async (req) => {
  const url = new URL(req.url);
  const session = await auth().api.getSession({ headers: req.headers });
  if (!session) return NextResponse.redirect(new URL("/sign-in", url), 302);
  const cookie = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);
  const q = url.searchParams;
  let state: string | undefined;
  try {
    state = cookie ? decodeURIComponent(cookie) : undefined;
  } catch {
    state = undefined; // a mangled cookie: treated like a missing one
  }
  const to = await instagramSvc().finish(session.user.id, state, {
    code: q.get("code"),
    state: q.get("state"),
    error: q.get("error"),
    errorReason: q.get("error_reason"),
  });
  const res = NextResponse.redirect(new URL(to, url), 302);
  res.cookies.set(STATE_COOKIE, "", { path: "/api/instagram", maxAge: 0 });
  return res;
});
