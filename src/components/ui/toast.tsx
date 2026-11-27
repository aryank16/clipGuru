import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A dark bar floating above the bottom of the screen, with an optional action ("Deleted … · Undo"). */
export function Toast({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl bg-ink-strong px-5 py-3.5 text-on-ink shadow-lg lg:bottom-8",
        className,
      )}
    >
      <span className="truncate text-[15px]">{children}</span>
      {action}
    </div>
  );
}
