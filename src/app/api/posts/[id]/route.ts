import { json, route } from "@/lib/api/route";
import { postSvc } from "@/lib/posts";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/posts/:id — polled while a post is being sent. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json({ post: await postSvc().get(user.id, id) });
});
