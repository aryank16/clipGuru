import { json, route } from "@/lib/api/route";
import { renderSvc } from "@/lib/render";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/projects/:id/renders — the newest render of this video, or null. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json({ render: await renderSvc().latest(user.id, id) });
});

/** POST /api/projects/:id/renders — make the video of the current storyboard. 202: the job runs in the background. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json({ render: await renderSvc().create(user.id, id) }, 202);
});
