import { parseBody, route } from "@/lib/api/route";
import { ideaChat } from "@/lib/chat/idea-chat";
import { chatRepo } from "@/lib/chat/repo";
import { chatBody } from "@/lib/chat/schemas";
import { projectsRepo } from "@/lib/projects/repo";
import { requireApiSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

// A reply with a tool call is two model calls; Gemini retries can add a few seconds each.
export const maxDuration = 60;

/** POST /api/projects/:id/chat — send a message on the idea step and stream the reply (SSE). */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const body = await parseBody(req, chatBody);
  return ideaChat(
    { projects: projectsRepo(), chat: chatRepo() },
    { userId: user.id, projectId: id, rev: body.rev, text: body.text },
  );
});
