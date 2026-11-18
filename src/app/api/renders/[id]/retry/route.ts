import { json, route } from "@/lib/api/route";
import { renderSvc } from "@/lib/render";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/renders/:id/retry — try a failed render again (the voice is reused). */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json({ render: await renderSvc().retry(user.id, id) }, 202);
});
