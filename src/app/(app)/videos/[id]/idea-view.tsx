import { notFound } from "next/navigation";
import { IdeaStep } from "@/components/idea/idea-step";
import { chatRepo } from "@/lib/chat/repo";
import { toChatMessage } from "@/lib/chat/types";
import { toProject, type ProjectRecord } from "@/lib/projects/types";

/** Step 1 for a loaded project (read-only once the storyboard exists). */
export async function IdeaView({ project, userId }: { project: ProjectRecord | null; userId: string }) {
  if (!project) notFound();
  const messages = await chatRepo().list(userId, project.id, "idea");
  // Keyed by project so switching videos starts a fresh chat.
  return <IdeaStep key={project.id} project={toProject(project)} initialMessages={messages.map(toChatMessage)} />;
}
