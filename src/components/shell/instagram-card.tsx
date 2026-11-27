import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { instagramSvc } from "@/lib/instagram";
import { cn } from "@/lib/cn";
import { requirePageSession } from "@/lib/session";

/** Sidebar card showing the linked Instagram account; opens Settings. */
export async function InstagramCard() {
  const { user } = await requirePageSession();
  const s = await instagramSvc().status(user.id);
  const ok = s.connected && s.status === "connected";
  const line = !s.connected ? "Not connected" : ok ? `@${s.username}` : "Reconnect needed";
  return <InstagramCardView tone={ok ? "ok" : s.connected ? "warn" : "off"} line={line} />;
}

export function InstagramCardView({ tone, line }: { tone: "ok" | "warn" | "off"; line: string }) {
  return (
    <Link
      href="/settings#instagram"
      className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3.5 transition-colors hover:border-muted/40"
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", tone === "ok" ? "bg-success" : tone === "warn" ? "bg-progress" : "bg-muted/50")}
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-ink">Instagram</span>
        <span className={cn("truncate text-xs", tone === "warn" ? "text-progress" : "text-muted")}>{line}</span>
      </span>
      <ChevronRight className="size-4 text-muted" aria-hidden />
    </Link>
  );
}
