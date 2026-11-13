import { ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * Sidebar card showing the Instagram link. Nobody can connect yet (that arrives with F12),
 * so it always shows the "not connected" state and points to Settings.
 */
export function InstagramCard() {
  return (
    <Link
      href="/settings"
      className="flex items-center gap-3 rounded-xl border border-hairline bg-paper px-4 py-3.5 transition-colors hover:border-taupe/40"
    >
      <span className="size-2 shrink-0 rounded-full bg-taupe/50" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-espresso">Instagram</span>
        <span className="text-xs text-taupe">Not connected</span>
      </span>
      <ChevronRight className="size-4 text-taupe" aria-hidden />
    </Link>
  );
}
