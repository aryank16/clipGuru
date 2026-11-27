import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { VideoLibrary } from "@/components/videos/library";
import { projectsRepo } from "@/lib/projects/repo";
import { toMe } from "@/lib/me";
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
  // New accounts see the welcome screen first, once, whichever way they signed up. Accounts that
  // already have videos (made before the welcome screen existed, or via New video) skip it.
  if (!toMe(user).onboarded && counts.all === 0) redirect("/welcome");
  return (
    <VideoLibrary initial={{ items: page.items.map(toProject), nextCursor: page.nextCursor }} initialCounts={counts} />
  );
}

function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <div className="h-[61px] border-b border-line" />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-[9/19] animate-pulse rounded-xl border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}
