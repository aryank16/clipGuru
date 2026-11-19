import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { instagramDriver } from "@/lib/env";
import { instagramSvc } from "@/lib/instagram";
import { safeReturnTo, STATE_COOKIE, STATE_MAX_AGE_SEC, withResult } from "@/lib/instagram/service";
import { auth } from "@/lib/auth";

/**
 * GET /api/instagram/connect?returnTo=/settings — the Connect button. Sends the browser to Meta's
 * login (Instagram or Facebook) with a signed state cookie; Meta sends it back to the callback.
 */
export const GET = route(async (req) => {
  const url = new URL(req.url);
  const session = await auth().api.getSession({ headers: req.headers });
  if (!session) return NextResponse.redirect(new URL("/sign-in", url), 302);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  // Local tests can ask the fake login for a given answer.
  const scenario = instagramDriver() === "fake" ? (url.searchParams.get("scenario") ?? undefined) : undefined;
  const started = instagramSvc().start(session.user.id, returnTo, scenario);
  if (!started) return NextResponse.redirect(new URL(withResult(returnTo, { ok: false, reason: "UNKNOWN" }), url), 302);
  const res = NextResponse.redirect(started.url, 302);
  res.cookies.set(STATE_COOKIE, started.cookie, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/instagram",
    maxAge: STATE_MAX_AGE_SEC,
  });
  return res;
});
