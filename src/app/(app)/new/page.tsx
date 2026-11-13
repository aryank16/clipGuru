import { Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "New video" };

/** Step 1 of a new video. The idea chat arrives with F6. */
export default function NewVideoPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="New video" />
      <EmptyState icon={<Lightbulb className="size-5" />} title="Coming soon">
        This is where you&apos;ll chat through your idea before ClipGuru writes the storyboard.
      </EmptyState>
    </div>
  );
}
