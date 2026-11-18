import { json, route } from "@/lib/api/route";
import { renderSvc } from "@/lib/render";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/renders/:id — status and progress; the Video page polls it every 2 seconds. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json({ render: await renderSvc().get(user.id, id) });
});
