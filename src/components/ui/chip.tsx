import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const looks = {
  /** Light toggle: accent tint when on (brief options such as length and tone). */
  soft: {
    base: "rounded-md text-sm",
    on: "border-accent bg-accent/30 font-medium text-ink",
    off: "border-line text-muted hover:border-muted/40 hover:text-ink",
  },
  /** Solid toggle: ink fill when on (filters). */
  solid: {
    base: "rounded-lg text-[15px]",
    on: "border-ink-strong bg-ink-strong text-on-ink",
    off: "border-line bg-surface text-ink hover:border-muted/40",
  },
} as const;

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** On or off. Sets aria-pressed, unless the chip is a tab (role="tab" sets aria-selected instead). */
  selected: boolean;
  look?: keyof typeof looks;
};

/** A small toggle button, one of a set of options. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected, look = "soft", className, type = "button", role, ...props },
  ref,
) {
  const l = looks[look];
  return (
    <button
      ref={ref}
      type={type}
      role={role}
      aria-pressed={role === "tab" ? undefined : selected}
      aria-selected={role === "tab" ? selected : undefined}
      className={cn(
        "min-h-9 border px-3 transition-colors disabled:opacity-60",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        l.base,
        selected ? l.on : l.off,
        className,
      )}
      {...props}
    />
  );
});
