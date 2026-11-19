import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { projectsRepo } from "@/lib/projects/repo";
import { requirePageSession } from "@/lib/session";
import { IdeaView } from "./idea-view";

export const metadata: Metadata = { title: "Video" };

/** One video: opens the step it's on. Step 1 is the idea chat, step 2 the storyboard, step 3 the video once one has been made, step 4 once a post was started. */
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
  if (project?.latestRenderId && project.step === "post") redirect(`/videos/${id}/post`);
  if (project?.latestRenderId) redirect(`/videos/${id}/video`);
  if (project && project.currentVersion > 0) redirect(`/videos/${id}/storyboard`);
  return <IdeaView project={project} userId={user.id} />;
}
