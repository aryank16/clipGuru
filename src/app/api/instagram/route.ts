import { json, route } from "@/lib/api/route";
import { instagramSvc } from "@/lib/instagram";
import { postSvc } from "@/lib/posts";
import { requireApiSession } from "@/lib/session";

/** GET /api/instagram — the linked account, if any. */
export const GET = route(async (req) => {
  const { user } = await requireApiSession(req);
  return json({ instagram: await instagramSvc().status(user.id) });
});

/** DELETE /api/instagram — unlinks the account and forgets its token. Scheduled posts are held. */
export const DELETE = route(async (req) => {
  const { user } = await requireApiSession(req);
  const instagram = await instagramSvc().disconnect(user.id);
  const heldPosts = await postSvc().holdAll(user.id);
  return json({ instagram, heldPosts });
});
