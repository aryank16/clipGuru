"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Two to four mutually exclusive options side by side ("Post now" | "Schedule"). A radio group:
 * arrow keys move the choice, and only the chosen option is in the tab order.
 */
export function Segmented<T extends string>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  className,
}: {
  label?: string;
  labelledBy?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={box}
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn("grid gap-2 rounded-lg bg-surface-sunken p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onKeyDown={(e) => {
        const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const i = options.findIndex((o) => o.value === value);
        const next = (i + step + options.length) % options.length;
        onChange(options[next].value);
        (box.current?.children[next] as HTMLElement | undefined)?.focus();
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-11 rounded-md text-sm font-medium transition-colors sm:h-10",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            value === o.value ? "bg-surface shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
