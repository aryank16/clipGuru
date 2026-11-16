import { z } from "zod";
import { json, parseBody, parseQuery, route } from "@/lib/api/route";
import { requireApiSession } from "@/lib/session";
import { voiceoverSvc } from "@/lib/voiceover";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

const version = z.coerce.number().int().min(1).optional();

/** GET /api/projects/:id/voiceover?version — the recording for that version and the project's voice, if made. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const q = parseQuery(req, z.object({ version }));
  return json({ voiceover: await voiceoverSvc().find(user.id, id, q.version) });
});

/** POST /api/projects/:id/voiceover — record it (or reuse the one made for the same narration and voice). */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const body = await parseBody(req, z.object({ version }).strict());
  const out = await voiceoverSvc().create(user.id, id, body.version);
  return json(out, out.reused ? 200 : 201);
});
