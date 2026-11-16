import { NextResponse } from "next/server";
import { json, parseBody, route } from "@/lib/api/route";
import { auth } from "@/lib/auth";
import { chatRepo } from "@/lib/chat/repo";
import { deleteMeBody, patchMeBody, toMe } from "@/lib/me";
import { projectsRepo } from "@/lib/projects/repo";
import { requireApiSession } from "@/lib/session";

/** GET /api/me — the signed-in user. Instagram and limits fill in with F10 and F12. */
export const GET = route(async (req) => {
  const { user } = await requireApiSession(req);
  return json({
    user: toMe(user),
    instagram: { connected: false },
    limits: { rendersRunning: 0, rendersToday: 0, maxRunning: 3, maxPerDay: 10 },
  });
});

/** PATCH /api/me — name, time zone, default voice, onboarded. */
export const PATCH = route(async (req) => {
  const { user } = await requireApiSession(req);
  const { onboarded, ...rest } = await parseBody(req, patchMeBody);
  const data: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (onboarded && !user.onboardedAt) data.onboardedAt = new Date();
  const ctx = await auth().$context;
  const updated = await ctx.internalAdapter.updateUser(user.id, data);
  return json(toMe({ ...user, ...(updated ?? data) } as typeof user));
});

const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

/** DELETE /api/me — delete the account, its videos and every session. */
export const DELETE = route(async (req) => {
  const { user } = await requireApiSession(req);
  await parseBody(req, deleteMeBody);
  // Scheduled posts (F13) get cancelled here once they exist.
  await projectsRepo().deleteAllForUser(user.id);
  await chatRepo().deleteAllForUser(user.id);
  const ctx = await auth().$context;
  await ctx.internalAdapter.deleteUser(user.id); // also removes sessions and linked sign-in methods
  const res = NextResponse.json({ deleted: true }, { status: 202 });
  for (const name of SESSION_COOKIES) {
    res.cookies.set(name, "", { maxAge: 0, path: "/", secure: name.startsWith("__Secure-") });
  }
  return res;
});
