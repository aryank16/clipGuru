import { json, parseBody, route } from "@/lib/api/route";
import { postSvc } from "@/lib/posts";
import { retryPostBody } from "@/lib/posts/service";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/posts/:id/retry — a post that didn't go out, now or at a new time. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json({ post: await postSvc().retry(user.id, id, await parseBody(req, retryPostBody)) });
});
