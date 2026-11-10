import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-14 w-full rounded-lg border border-hairline bg-surface px-4 text-[15px] text-espresso",
          "placeholder:text-taupe/70 transition-colors",
          "focus:border-sand-gold focus:outline-none focus:ring-2 focus:ring-sand-gold/40",
          "aria-[invalid=true]:border-danger/60",
          className,
        )}
        {...props}
      />
    );
  },
);

/** Label + control + optional hint/error, stacked. */
export function Field({
  label,
  htmlFor,
  aside,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  aside?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium text-espresso">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
