import { parseBody, route } from "@/lib/api/route";
import { ideaChat } from "@/lib/chat/idea-chat";
import { chatRepo } from "@/lib/chat/repo";
import { storyboardChat } from "@/lib/chat/storyboard-chat";
import { chatBody } from "@/lib/chat/schemas";
import { projectsRepo } from "@/lib/projects/repo";
import { requireApiSession } from "@/lib/session";
import { storyboardRepo } from "@/lib/storyboard/repo";
import { geminiWriter } from "@/lib/storyboard/writer";

type Ctx = { params: Promise<{ id: string }> };

// A reply with a tool call is two model calls (three when it revises the storyboard).
export const maxDuration = 90;

/** POST /api/projects/:id/chat — send a message on the idea or storyboard step and stream the reply (SSE). */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user } = await requireApiSession(req);
  const { id } = await params;
  const body = await parseBody(req, chatBody);
  const input = { userId: user.id, projectId: id, rev: body.rev, text: body.text };
  const deps = { projects: projectsRepo(), chat: chatRepo() };
  if (body.step === "storyboard") {
    return storyboardChat({ ...deps, storyboards: storyboardRepo(), writer: geminiWriter }, input);
  }
  return ideaChat(deps, input);
});
