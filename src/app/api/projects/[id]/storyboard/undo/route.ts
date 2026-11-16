import { json, parseBody, route } from "@/lib/api/route";
import { storyboards } from "@/lib/storyboard";
import { undoBody } from "@/lib/storyboard/schemas";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/projects/:id/storyboard/undo — back to the version before, saved as a new version. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const { rev } = await parseBody(req, undoBody);
  return json(await storyboards().undo(user.id, id, rev), 201);
});
