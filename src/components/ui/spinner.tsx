import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/** A spinning ring for "working on it". Decorative: pair it with text or an aria-label nearby. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden />;
}
