"use client";

import { useEffect, type FormEventHandler, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A modal panel over a dimmed page: a sheet from the bottom on phones, centred on larger screens.
 * Escape or a click outside closes it (unless `locked`, e.g. while saving). The panel is a form,
 * so Enter submits.
 */
export function Dialog({
  titleId,
  onClose,
  onSubmit,
  locked = false,
  className,
  children,
}: {
  /** The id of the dialog's heading, for screen readers. */
  titleId: string;
  onClose: () => void;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  locked?: boolean;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4 sm:items-center" onMouseDown={() => !locked && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={onSubmit ?? ((e) => e.preventDefault())}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn("flex w-full max-w-md flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-xl", className)}
      >
        {children}
      </form>
    </div>
  );
}
