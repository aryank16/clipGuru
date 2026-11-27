import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink-strong text-on-ink hover:bg-ink-strong-hover shadow-sm disabled:bg-ink-strong/60",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-hover hover:border-muted/40 shadow-sm",
  ghost: "text-ink hover:bg-surface-sunken/70",
  danger: "bg-surface text-danger border border-line hover:border-danger/40 hover:bg-surface-hover",
};

const sizes: Record<Size, string> = {
  sm: "h-11 sm:h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-[15px] gap-2 rounded-lg",
  lg: "h-14 px-6 text-base gap-2 rounded-xl",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner before the label, disables the button and marks it busy. */
  loading?: boolean;
};

/** Atelier Light button. Primary = espresso, secondary = paper with hairline. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-not-allowed disabled:opacity-70",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

/** Class names for a Link styled as a button. */
export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    variants[variant],
    sizes[size],
    className,
  );
}
