import { json, parseBody, route } from "@/lib/api/route";
import { projectsRepo } from "@/lib/projects/repo";
import { patchBody } from "@/lib/projects/schemas";
import { projectService } from "@/lib/projects/service";
import { storyboards } from "@/lib/storyboard";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/projects/:id — storyboard, renders and posts join this as their features land. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const project = await projectService(projectsRepo()).get(user.id, id);
  const storyboard = project.currentVersion > 0 ? await storyboards().get(user.id, id) : null;
  return json({ project, storyboard, latestRender: null, posts: [] });
});

/** PATCH /api/projects/:id — rename, edit the brief or pick a voice. Needs the current rev. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const body = await parseBody(req, patchBody);
  return json(await projectService(projectsRepo()).patch(user.id, id, body));
});

/** DELETE /api/projects/:id — soft delete; restorable for 30 days. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json(await projectService(projectsRepo()).remove(user.id, id));
});
