import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/route";
import { renderRepo } from "@/lib/render/repo";
import { requireApiSession } from "@/lib/session";
import { storage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/renders/:id/video — the MP4 for the player: a redirect to a short-lived R2 link (or the bytes, locally). */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const r = await renderRepo().get(user.id, id);
  if (!r) throw new ApiError("NOT_FOUND");
  if (r.status !== "ready" || !r.videoKey) throw new ApiError("RENDER_NOT_READY", "This video isn't ready yet.");
  const files = storage();
  if (files.read) {
    const f = await files.read(r.videoKey);
    if (!f) throw new ApiError("NOT_FOUND");
    return new NextResponse(f.body as BodyInit, {
      headers: { "content-type": f.contentType, "content-length": String(f.body.byteLength) },
    });
  }
  return NextResponse.redirect(await files.signedUrl(r.videoKey, 3600), 302);
});
