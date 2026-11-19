import { json, route } from "@/lib/api/route";
import { postSvc } from "@/lib/posts";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/posts/:id/cancel — a scheduled post, until 5 minutes before its time. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json({ post: await postSvc().cancel(user.id, id) });
});
