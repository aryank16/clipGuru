import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { VideoStep } from "@/components/video/video-step";
import { projectsRepo } from "@/lib/projects/repo";
import { toProject } from "@/lib/projects/types";
import { renderSvc } from "@/lib/render";
import { requirePageSession } from "@/lib/session";

export const metadata: Metadata = { title: "Video" };

/** Step 3: the video being made, or made. Without a render yet, back to the storyboard. */
export default function VideoStepPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Video params={params} />
    </Suspense>
  );
}

async function Video({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePageSession();
  const { id } = await params;
  if (!(await projectsRepo().get(user.id, id))) notFound();
  // Through the service, so a stuck render shows as failed (with Try again) rather than spinning forever.
  const render = await renderSvc().latest(user.id, id);
  if (!render) redirect(`/videos/${id}/storyboard`);
  const project = await projectsRepo().get(user.id, id);
  if (!project) notFound();
  return <VideoStep key={render.id} project={toProject(project)} initialRender={render} />;
}
