import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Scheduled" };

/** Scheduled posts. The calendar arrives with F14. */
export default function ScheduledPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Scheduled" />
      <EmptyState icon={<CalendarClock className="size-5" />} title="Nothing scheduled">
        Videos you schedule for Instagram will show here with their posting time.
      </EmptyState>
    </div>
  );
}
