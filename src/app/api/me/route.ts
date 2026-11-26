import { renderSvc } from "@/lib/render";
import { renderRepo } from "@/lib/render/repo";
import { deleteFiles } from "@/lib/maintenance";
import { pendingDeletions } from "@/lib/pending-deletions";
import { NextResponse } from "next/server";
import { json, parseBody, route } from "@/lib/api/route";
import { auth } from "@/lib/auth";
import { storageIfConfigured, userPrefix } from "@/lib/storage";
import { storyboardRepo } from "@/lib/storyboard/repo";
import { voiceoverRepo } from "@/lib/voiceover/repo";
import { chatRepo } from "@/lib/chat/repo";
import { deleteMeBody, patchMeBody, toMe } from "@/lib/me";
import { instagramSvc } from "@/lib/instagram";
import { instagramRepo } from "@/lib/instagram/repo";
import { postsRepo } from "@/lib/posts/repo";
import { projectsRepo } from "@/lib/projects/repo";
import { requireApiSession } from "@/lib/session";

/** GET /api/me — the signed-in user, their Instagram link, and this month's video count. */
export const GET = route(async (req) => {
  const { user } = await requireApiSession(req);
  return json({
    user: toMe(user),
    instagram: await instagramSvc().status(user.id),
    videos: await renderSvc().usage(user.id),
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
  // Posts go first: a scheduled post's sleeping run finds nothing when it wakes, so it never posts.
  await postsRepo().deleteAllForUser(user.id);
  await projectsRepo().deleteAllForUser(user.id);
  await chatRepo().deleteAllForUser(user.id);
  await storyboardRepo().deleteAllForUser(user.id);
  await voiceoverRepo().deleteAllForUser(user.id);
  await renderRepo().deleteAllForUser(user.id);
  await instagramRepo().delete(user.id);
  // Remembered first, so the daily cleanup retries it if this fails.
  await deleteFiles(storageIfConfigured(), pendingDeletions(), userPrefix(user.id)).catch((err) =>
    console.error("[me] file cleanup failed; the daily cleanup will retry", err),
  );
  const ctx = await auth().$context;
  await ctx.internalAdapter.deleteUser(user.id); // also removes sessions and linked sign-in methods
  const res = NextResponse.json({ deleted: true }, { status: 202 });
  for (const name of SESSION_COOKIES) {
    res.cookies.set(name, "", { maxAge: 0, path: "/", secure: name.startsWith("__Secure-") });
  }
  return res;
});
