import { ApiError } from "@/lib/api/errors";
import { json, parseBody, route } from "@/lib/api/route";
import { storyboards } from "@/lib/storyboard";
import { regenerateBody, sceneIndex } from "@/lib/storyboard/schemas";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string; index: string }> };

export const maxDuration = 60;

/** POST /api/projects/:id/storyboard/scenes/:index/regenerate — a fresh take on one scene (0-based). */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id, index } = await params;
  const i = sceneIndex.safeParse(index);
  if (!i.success) throw new ApiError("SCENE_NOT_FOUND", "That scene doesn't exist.");
  const body = await parseBody(req, regenerateBody);
  return json(await storyboards().regenerateScene(user.id, id, i.data, body), 201);
});
