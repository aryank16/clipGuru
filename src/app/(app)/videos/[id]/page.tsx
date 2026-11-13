import { ArrowLeft, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { projectsRepo } from "@/lib/projects/repo";
import { STATUS_LABELS } from "@/lib/projects/types";
import { requirePageSession } from "@/lib/session";

export const metadata: Metadata = { title: "Video" };

/** One video. The idea chat (F6), storyboard (F7) and render (F12) steps fill this in. */
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
  return (
    <div className="flex flex-col gap-8">
      <Link href="/videos" className="inline-flex items-center gap-2 text-sm text-taupe hover:text-espresso">
        <ArrowLeft className="size-4" /> My videos
      </Link>
      <PageHeader title={project.title} count={STATUS_LABELS[project.status]} />
      <EmptyState icon={<Lightbulb className="size-5" />} title="Idea chat comes next">
        This is where you&apos;ll talk through your idea before ClipGuru writes the storyboard.
      </EmptyState>
    </div>
  );
}
