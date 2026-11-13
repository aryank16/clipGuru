import type { Metadata } from "next";
import { Suspense } from "react";
import { VideoLibrary } from "@/components/videos/library";
import { projectsRepo } from "@/lib/projects/repo";
import { toProject } from "@/lib/projects/types";
import { requirePageSession } from "@/lib/session";

export const metadata: Metadata = { title: "My videos" };

export default function VideosPage() {
  return (
    <Suspense fallback={<LibrarySkeleton />}>
      <Library />
    </Suspense>
  );
}

async function Library() {
  const { user } = await requirePageSession();
  const repo = projectsRepo();
  const [page, counts] = await Promise.all([repo.list(user.id, { filter: "all", limit: 20 }), repo.counts(user.id)]);
  return (
    <VideoLibrary initial={{ items: page.items.map(toProject), nextCursor: page.nextCursor }} initialCounts={counts} />
  );
}

function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <div className="h-[61px] border-b border-hairline" />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-[9/19] animate-pulse rounded-xl border border-hairline bg-surface" />
        ))}
      </div>
    </div>
  );
}
