import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const sizes = { sm: "size-9", md: "size-10", lg: "size-11" } as const;
const tones = {
  /** Ink icon with a soft background on hover (toolbars, pagers). */
  default: "text-ink hover:bg-surface-sunken/70",
  /** Quiet icon that darkens on hover (inline actions next to text). */
  muted: "text-muted hover:text-ink",
  /** Filled primary (send buttons). */
  primary: "bg-ink-strong text-on-ink hover:bg-ink",
} as const;

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** What the button does, read by screen readers (the icon itself is decorative). */
  label: string;
  icon: ReactNode;
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
};

/** A square button with just an icon. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = "lg", tone = "default", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        sizes[size],
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
});
