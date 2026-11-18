import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/route";
import { serveFile } from "@/lib/api/serve-file";
import { renderRepo } from "@/lib/render/repo";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string; n: string }> };

/** GET /api/renders/:id/covers/:n — one of the suggested cover frames. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id, n } = await params;
  const r = await renderRepo().get(user.id, id);
  if (!r) throw new ApiError("NOT_FOUND");
  if (r.status !== "ready") throw new ApiError("RENDER_NOT_READY", "This video isn't ready yet.");
  const cover = /^\d+$/.test(n) ? r.covers?.[Number(n)] : undefined;
  if (!cover) throw new ApiError("NOT_FOUND");
  return serveFile(cover.key);
});
