import Link from "next/link";
import { cn } from "@/lib/cn";

/** Privacy · Terms · Data deletion, for footers. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={cn("flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted", className)}>
      <Link href="/privacy" className="tap hover:text-ink hover:underline">
        Privacy
      </Link>
      <Link href="/terms" className="tap hover:text-ink hover:underline">
        Terms
      </Link>
      <Link href="/data-deletion" className="tap hover:text-ink hover:underline">
        Data deletion
      </Link>
    </nav>
  );
}
