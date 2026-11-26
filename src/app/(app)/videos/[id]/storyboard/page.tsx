import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { StoryboardStep } from "@/components/storyboard/storyboard-step";
import { WritingStoryboard } from "@/components/storyboard/writing";
import { chatRepo } from "@/lib/chat/repo";
import { toChatMessage } from "@/lib/chat/types";
import { voiceDriver } from "@/lib/env";
import { projectsRepo } from "@/lib/projects/repo";
import { renderSvc } from "@/lib/render";
import { toProject } from "@/lib/projects/types";
import { requirePageSession } from "@/lib/session";
import { storyboards } from "@/lib/storyboard";

export const metadata: Metadata = { title: "Storyboard" };

/** Step 2: the script and scenes. Without a storyboard yet, back to step 1. */
export default function StoryboardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<WritingStoryboard loading />}>
      <Storyboard params={params} />
    </Suspense>
  );
}

async function Storyboard({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePageSession();
  const { id } = await params;
  const project = await projectsRepo().get(user.id, id);
  if (!project) notFound();
  if (project.currentVersion === 0) redirect(`/videos/${id}`);
  const [version, messages, videos] = await Promise.all([
    storyboards().get(user.id, id),
    chatRepo().list(user.id, id, "storyboard"),
    renderSvc().usage(user.id),
  ]);
  return (
    <StoryboardStep
      key={project.id}
      project={toProject(project)}
      initialVersion={version}
      initialMessages={messages.map(toChatMessage)}
      videosLeft={videos.left}
      testVoice={voiceDriver() === "test"}
    />
  );
}
