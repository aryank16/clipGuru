import { json, parseBody, route } from "@/lib/api/route";
import { postSvc } from "@/lib/posts";
import { captionBody } from "@/lib/posts/service";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/projects/:id/caption — a suggested caption and hashtags. Nothing is saved. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const { tone } = await parseBody(req, captionBody);
  return json(await postSvc().caption(user.id, id, tone));
});
