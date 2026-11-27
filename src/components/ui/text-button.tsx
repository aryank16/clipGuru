import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const tones = {
  muted: "text-muted hover:text-ink",
  ink: "text-ink",
  accent: "font-semibold text-accent",
} as const;

/** A button that reads like a link: for secondary actions inside text ("Undo", "Reset", "Restore"). */
export const TextButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof tones; underline?: "hover" | "always" }
>(function TextButton({ tone = "muted", underline = "hover", className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "w-fit text-sm font-medium underline-offset-4 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-not-allowed disabled:opacity-50",
        underline === "always" ? "underline" : "hover:underline",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
});
