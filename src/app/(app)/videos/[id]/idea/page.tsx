import type { Metadata } from "next";
import { Suspense } from "react";
import { projectsRepo } from "@/lib/projects/repo";
import { requirePageSession } from "@/lib/session";
import { IdeaView } from "../idea-view";

export const metadata: Metadata = { title: "Idea" };

/** Step 1, also after the storyboard exists (then read-only). */
export default function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Idea params={params} />
    </Suspense>
  );
}

async function Idea({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePageSession();
  const { id } = await params;
  return <IdeaView project={await projectsRepo().get(user.id, id)} userId={user.id} />;
}
