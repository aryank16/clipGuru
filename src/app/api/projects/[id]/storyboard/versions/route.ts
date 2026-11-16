import { json, route } from "@/lib/api/route";
import { storyboards } from "@/lib/storyboard";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/projects/:id/storyboard/versions — newest first, without the storyboards. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json({ items: await storyboards().versions(user.id, id) });
});
