import { json, parseQuery, route } from "@/lib/api/route";
import { projectsRepo } from "@/lib/projects/repo";
import { listQuery } from "@/lib/projects/schemas";
import { projectService } from "@/lib/projects/service";
import { toProject } from "@/lib/projects/types";
import { requireApiSession } from "@/lib/session";

/** GET /api/projects?filter=&q=&limit=&cursor= — the signed-in user's videos, newest edit first. */
export const GET = route(async (req) => {
  const { user } = await requireApiSession(req);
  const query = parseQuery(req, listQuery);
  const page = await projectsRepo().list(user.id, query);
  return json({ items: page.items.map(toProject), nextCursor: page.nextCursor });
});

/** POST /api/projects — start a new video. */
export const POST = route(async (req) => {
  const { user } = await requireApiSession(req);
  const project = await projectService(projectsRepo()).create(user.id, user.defaultVoiceId);
  return json(project, 201);
});
