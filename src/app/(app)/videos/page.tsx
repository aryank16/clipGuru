import { ArrowRight, Play, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "My videos" };

/** My videos. The grid, filters and search arrive with F3; until then there are no videos to list. */
export default function VideosPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="My videos"
        count="0 videos"
        actions={
          <div className="hidden lg:block">
            <Link href="/new" className={buttonClasses("primary", "md")}>
              <Plus className="size-4" /> New video
            </Link>
          </div>
        }
      />
      <EmptyState
        icon={<Play className="size-5" />}
        title="No videos yet"
        action={
          <Link href="/new" className={buttonClasses("primary", "lg")}>
            New video <ArrowRight className="size-4" />
          </Link>
        }
      >
        Start with an idea and ClipGuru writes, voices and animates it.
      </EmptyState>
    </div>
  );
}
