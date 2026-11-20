import type { Metadata } from "next";
import { Suspense } from "react";
import { ScheduledView, type ScheduledItem } from "@/components/scheduled/scheduled-view";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/defaults";
import { postSvc } from "@/lib/posts";
import { RECENT_DAYS } from "@/lib/posts/schedule-view";
import { SCHEDULE_MAX_MS } from "@/lib/posts/types";
import { projectsRepo } from "@/lib/projects/repo";
import { requirePageSession } from "@/lib/session";

export const metadata: Metadata = { title: "Scheduled" };

const DAY = 24 * 3600_000;

/** Every upcoming Instagram post in one place, plus recent ones and any that need attention (design 11). */
export default function ScheduledPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Scheduled" />
      <Suspense fallback={<Card className="h-96 animate-pulse" />}>
        <Scheduled />
      </Suspense>
    </div>
  );
}

async function Scheduled() {
  const { user } = await requirePageSession();
  const now = new Date();
  // From a month back (recent and failed) to the furthest a post can be scheduled, with a day to spare.
  const posts = await postSvc().list(user.id, {
    from: new Date(now.getTime() - RECENT_DAYS * DAY),
    to: new Date(now.getTime() + SCHEDULE_MAX_MS + DAY),
  });
  const repo = projectsRepo();
  const ids = [...new Set(posts.map((p) => p.projectId))];
  const titles = new Map(await Promise.all(ids.map(async (id) => [id, (await repo.get(user.id, id))?.title ?? null] as const)));
  const items: ScheduledItem[] = posts.map((p) => ({ ...p, title: titles.get(p.projectId) ?? null }));
  const tz = (user as { timeZone?: string }).timeZone;
  return <ScheduledView items={items} timeZone={tz && isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE} />;
}
