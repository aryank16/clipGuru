import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { VideoStep } from "@/components/video/video-step";
import { projectsRepo } from "@/lib/projects/repo";
import { toProject } from "@/lib/projects/types";
import { renderRepo } from "@/lib/render/repo";
import { toRender } from "@/lib/render/types";
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
  const project = await projectsRepo().get(user.id, id);
  if (!project) notFound();
  const render = await renderRepo().latestForProject(user.id, id);
  if (!render) redirect(`/videos/${id}/storyboard`);
  return <VideoStep key={render.id} project={toProject(project)} initialRender={toRender(render)} />;
}
