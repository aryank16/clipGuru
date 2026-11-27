import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/** What every text field shares: border, text, placeholder, focus ring, invalid state. */
export const fieldClasses = cn(
  "w-full rounded-lg border border-line text-[15px] text-ink",
  "placeholder:text-muted/70 transition-colors",
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40",
  "aria-[invalid=true]:border-danger/60",
);

const inputSizes = {
  /** Tall field on a surface (sign-in, settings). */
  lg: "h-14 bg-surface px-4",
  /** Compact field on a tinted well (dialogs, pickers). */
  md: "h-12 bg-canvas/40 px-4",
} as const;

/** A borderless field that sits inside its own box (the brief's inline fields). */
const bareClasses =
  "w-full rounded-md bg-transparent text-[15px] text-ink placeholder:text-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-70";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: keyof typeof inputSizes;
  /** No border or background: for a field inside a box that already frames it. */
  bare?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, size = "lg", bare = false, ...props }, ref) {
  return <input ref={ref} className={cn(bare ? bareClasses : [fieldClasses, inputSizes[size]], className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { bare?: boolean }>(
  function Textarea({ className, bare = false, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(bare ? bareClasses : [fieldClasses, "bg-surface px-4 py-3 leading-relaxed"], className)}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cn(fieldClasses, "h-12 bg-canvas/40 px-3", className)} {...props} />;
});

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
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
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
