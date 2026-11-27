import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * An unstyled button for custom layouts (a whole card that can be tapped, a radio row, a cover
 * thumbnail). It only adds what every button needs: type="button" by default and a visible focus ring.
 * Reach for Button, IconButton, TextButton or Chip first.
 */
export const Pressable = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function Pressable(
  { className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", className)}
      {...props}
    />
  );
});
