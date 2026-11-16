import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/route";
import { requireApiSession } from "@/lib/session";
import { storage } from "@/lib/storage";
import { voiceoverSvc } from "@/lib/voiceover";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/voiceovers/:id/audio — the recording: a redirect to a short-lived R2 link (or the bytes, locally). */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const v = await voiceoverSvc().get(user.id, id);
  if (!v) throw new ApiError("NOT_FOUND");
  const files = storage();
  if (files.read) {
    const f = await files.read(v.audioKey);
    if (!f) throw new ApiError("NOT_FOUND");
    return new NextResponse(f.body as BodyInit, {
      headers: { "content-type": f.contentType, "content-length": String(f.body.byteLength) },
    });
  }
  return NextResponse.redirect(await files.signedUrl(v.audioKey, 3600), 302);
});
