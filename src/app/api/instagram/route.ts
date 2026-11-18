import { json, route } from "@/lib/api/route";
import { instagramSvc } from "@/lib/instagram";
import { requireApiSession } from "@/lib/session";

/** GET /api/instagram — the linked account, if any. */
export const GET = route(async (req) => {
  const { user } = await requireApiSession(req);
  return json({ instagram: await instagramSvc().status(user.id) });
});

/** DELETE /api/instagram — unlinks the account and forgets its token. */
export const DELETE = route(async (req) => {
  const { user } = await requireApiSession(req);
  return json({ instagram: await instagramSvc().disconnect(user.id) });
});
