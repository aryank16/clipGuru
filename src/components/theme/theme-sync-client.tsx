"use client";

import { useEffect } from "react";
import { DEFAULT_THEME_PREF, THEME_COOKIE, applyTheme, type ThemePref } from "@/lib/theme";

export function ThemeSyncClient({ theme }: { theme: ThemePref }) {
  useEffect(() => {
    const remembered = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([a-z-]+)`))?.[1];
    // Nothing to do when this browser already has it, or has nothing and the account uses the default.
    if (remembered === theme || (!remembered && theme === DEFAULT_THEME_PREF)) return;
    applyTheme(theme);
  }, [theme]);
  return null;
}
