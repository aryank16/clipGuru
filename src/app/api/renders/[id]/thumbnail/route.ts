import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/route";
import { serveFile } from "@/lib/api/serve-file";
import { renderRepo } from "@/lib/render/repo";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/renders/:id/thumbnail — the chosen cover: a redirect to a short-lived R2 link (or the bytes, locally). */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const r = await renderRepo().get(user.id, id);
  if (!r) throw new ApiError("NOT_FOUND");
  if (r.status !== "ready" || !r.thumbKey) throw new ApiError("RENDER_NOT_READY", "This video isn't ready yet.");
  return serveFile(r.thumbKey);
});
