import { DEFAULT_THEME, THEMES } from "@/design/tokens";

/** What a user can pick in Settings → Appearance: a theme, or "system" to follow the device. */
export const THEME_PREFS = [...THEMES.map((t) => t.id), "system"] as const;
export type ThemePref = string;

export const DEFAULT_THEME_PREF: ThemePref = DEFAULT_THEME.id;

/** Remembers the choice on this browser so the first paint already has it (no flash). */
export const THEME_COOKIE = "cg-theme";

export function isThemePref(v: unknown): v is ThemePref {
  return typeof v === "string" && (THEME_PREFS as readonly string[]).includes(v);
}

/**
 * Runs in <head> before the page paints: copies the remembered theme onto <html>. Kept tiny and
 * self-contained because it is inlined as a string.
 */
export const themeBootScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([a-z-]+)/);var ok=${JSON.stringify(THEME_PREFS)};if(m&&ok.indexOf(m[1])>-1)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}})();`;

/** Applies a theme on this page and remembers it on this browser for a year. */
export function applyTheme(pref: ThemePref) {
  document.documentElement.setAttribute("data-theme", pref);
  document.cookie = `${THEME_COOKIE}=${pref}; path=/; max-age=31536000; samesite=lax`;
}

/** Forgets this browser's theme (on sign-out, so the next person starts from the default). */
export function forgetTheme() {
  document.documentElement.removeAttribute("data-theme");
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
