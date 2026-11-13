import { json, route } from "@/lib/api/route";
import { projectsRepo } from "@/lib/projects/repo";
import { requireApiSession } from "@/lib/session";

/** GET /api/projects/counts — how many videos sit under each library filter. */
export const GET = route(async (req) => {
  const { user } = await requireApiSession(req);
  return json(await projectsRepo().counts(user.id));
});
