import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IdeaStep } from "@/components/idea/idea-step";
import { chatRepo } from "@/lib/chat/repo";
import { toChatMessage } from "@/lib/chat/types";
import { projectsRepo } from "@/lib/projects/repo";
import { toProject } from "@/lib/projects/types";
import { requirePageSession } from "@/lib/session";

export const metadata: Metadata = { title: "Video" };

/** One video. Step 1 is the idea chat; the storyboard (F7) and render (F12) steps follow. */
export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Video params={params} />
    </Suspense>
  );
}

async function Video({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePageSession();
  const { id } = await params;
  const project = await projectsRepo().get(user.id, id);
  if (!project) notFound();
  const messages = await chatRepo().list(user.id, id, "idea");
  // Keyed by project so switching videos starts a fresh chat.
  return <IdeaStep key={project.id} project={toProject(project)} initialMessages={messages.map(toChatMessage)} />;
}
