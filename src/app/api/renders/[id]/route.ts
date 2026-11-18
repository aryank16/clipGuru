import { z } from "zod";
import { json, parseBody, route } from "@/lib/api/route";
import { renderSvc } from "@/lib/render";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/renders/:id — status and progress; the Video page polls it every 2 seconds. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json({ render: await renderSvc().get(user.id, id) });
});

/** PATCH /api/renders/:id — body { coverIndex }: picks the cover from the suggested frames. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const body = await parseBody(req, z.object({ coverIndex: z.number().int().min(0) }).strict());
  return json({ render: await renderSvc().setCover(user.id, id, body.coverIndex) });
});
