import { ApiError } from "@/lib/api/errors";
import { json, parseQuery, route } from "@/lib/api/route";
import { chatRepo } from "@/lib/chat/repo";
import { messagesQuery } from "@/lib/chat/schemas";
import { toChatMessage } from "@/lib/chat/types";
import { projectsRepo } from "@/lib/projects/repo";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/projects/:id/messages?step=idea — the whole chat for one step, oldest first. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const { step } = parseQuery(req, messagesQuery);
  if (!(await projectsRepo().get(user.id, id))) throw new ApiError("NOT_FOUND");
  const items = await chatRepo().list(user.id, id, step);
  return json({ items: items.map(toChatMessage) });
});
