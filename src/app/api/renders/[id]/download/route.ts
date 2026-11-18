import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/route";
import { fileNameFor, serveFile } from "@/lib/api/serve-file";
import { projectsRepo } from "@/lib/projects/repo";
import { renderRepo } from "@/lib/render/repo";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/renders/:id/download — the MP4 as a file to save, named after the video's title. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const r = await renderRepo().get(user.id, id);
  if (!r) throw new ApiError("NOT_FOUND");
  if (r.status !== "ready" || !r.videoKey) throw new ApiError("RENDER_NOT_READY", "This video isn't ready yet.");
  const project = await projectsRepo().get(user.id, r.projectId);
  return serveFile(r.videoKey, { downloadAs: fileNameFor(project?.title ?? "", "mp4") });
});
