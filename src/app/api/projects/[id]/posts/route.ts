import { ApiError } from "@/lib/api/errors";
import { json, parseBody, route } from "@/lib/api/route";
import { postSvc } from "@/lib/posts";
import { createPostBody } from "@/lib/posts/service";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/projects/:id/posts — the video's newest post, or null. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  return json({ post: await postSvc().latest(user.id, id) });
});

/** POST /api/projects/:id/posts — post now or schedule. A repeated Idempotency-Key returns the same post. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const key = req.headers.get("idempotency-key");
  if (key !== null && !/^[\w-]{8,100}$/.test(key)) {
    throw new ApiError("VALIDATION_FAILED", "Bad Idempotency-Key header.", { idempotencyKey: "invalid" });
  }
  const body = await parseBody(req, createPostBody);
  const { post, created } = await postSvc().create(user.id, id, body, key);
  return json({ post }, created ? 201 : 200);
});
