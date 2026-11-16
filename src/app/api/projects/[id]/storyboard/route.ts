import { json, parseBody, parseQuery, route } from "@/lib/api/route";
import { storyboards } from "@/lib/storyboard";
import { generateBody, parseStoryboard, saveBody, versionQuery } from "@/lib/storyboard/schemas";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

// Writing a storyboard is one to three Gemini calls of 10 to 20 seconds each.
export const maxDuration = 120;

/** POST /api/projects/:id/storyboard — write version 1 from the brief; locks the brief. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const { rev } = await parseBody(req, generateBody);
  return json(await storyboards().generate(user.id, id, rev), 201);
});

/** GET /api/projects/:id/storyboard?version= — the current version, or an older one. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const { version } = parseQuery(req, versionQuery);
  return json(await storyboards().get(user.id, id, version));
});

/** PUT /api/projects/:id/storyboard — save a direct edit as a new version. */
export const PUT = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const body = await parseBody(req, saveBody);
  const storyboard = parseStoryboard(body.storyboard);
  return json(await storyboards().save(user.id, id, { rev: body.rev, baseVersion: body.baseVersion, storyboard }), 201);
});
