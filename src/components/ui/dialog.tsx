"use client";

import { useEffect, useRef, useState, type FormEventHandler, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A modal panel over a dimmed page: a sheet from the bottom on phones, centred on larger screens.
 * Escape or a click outside closes it (unless `locked`, e.g. while saving). The panel is a form,
 * so Enter submits. Tab stays inside the dialog, and focus goes back where it was on close.
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
  /** Sizes the dialog box (e.g. max-w-lg). The inner form keeps its own padding and gaps. */
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLFormElement>(null);
  // Read while rendering, before an autoFocus field inside takes focus.
  const [opener] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));

  // Focus into the dialog on open (unless a field autofocused), and back to the opener on close.
  useEffect(() => {
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
    return () => opener?.focus?.();
  }, [opener]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
      if (e.key === "Tab" && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-media/30 p-4 sm:items-center" onMouseDown={() => !locked && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn("w-full max-w-md", className)}>
        <form
          ref={panel}
          tabIndex={-1}
          onSubmit={onSubmit ?? ((e) => e.preventDefault())}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex w-full flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-xl outline-none"
        >
          {children}
        </form>
      </div>
    </div>
  );
}
