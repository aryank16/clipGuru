import { json, route } from "@/lib/api/route";
import { requireApiSession } from "@/lib/session";
import { VOICES } from "@/lib/voices";

/** GET /api/voices — the narrator voices with preview clips. */
export const GET = route(async (req) => {
  await requireApiSession(req);
  return json({ items: VOICES });
});
