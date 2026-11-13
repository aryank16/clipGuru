import { json, route } from "@/lib/api/route";
import { projectsRepo } from "@/lib/projects/repo";
import { projectService } from "@/lib/projects/service";
import { requireApiSession } from "@/lib/session";

/** POST /api/projects/:id/restore — undo a delete. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json(await projectService(projectsRepo()).restore(user.id, id));
});
