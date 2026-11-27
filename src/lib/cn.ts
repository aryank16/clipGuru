import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { COLOR_TOKENS, RADIUS_TOKENS, SHADOW_TOKENS } from "@/design/tokens";

/** Tailwind-merge that knows the design-token names, so `text-on-ink` is a colour and `shadow-card` a shadow. */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      color: [...COLOR_TOKENS],
      shadow: [...SHADOW_TOKENS],
      radius: [...RADIUS_TOKENS],
    },
  },
  // In Tailwind 4 a `leading-*` class always beats the line height that `text-*` sets, so the two
  // don't conflict. (tailwind-merge's default drops `leading-*` when a `text-*` size follows it.)
  override: { conflictingClassGroups: { "font-size": [] } },
});

/**
 * Join class names, skipping falsy values. When two classes set the same thing, the later one wins,
 * so a component's `className` prop can override its defaults.
 */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
