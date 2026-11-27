/**
 * ClipGuru's design-token contract.
 *
 * This file is the single source of truth for the app's look. Every screen styles itself only with
 * the semantic names below (Tailwind classes such as `bg-surface`, `text-ink`, `border-line`,
 * `shadow-card`); a theme is just a set of values for those names. `tokens.css` is generated from
 * this file (`npm run tokens`), and a test fails if the two drift apart or if a component uses a raw
 * colour instead of a token.
 *
 * Versioning: bump TOKENS_VERSION when the contract changes. Patch: a value changes. Minor: a token
 * is added. Major: a token is renamed or removed (every screen and theme must follow).
 */

export const TOKENS_VERSION = "1.1.0";

/** Semantic colour roles. Names say what a colour is for, never what it looks like. */
export const COLOR_TOKENS = [
  /** The page behind everything. */
  "canvas",
  /** Cards, panels, inputs. */
  "surface",
  /** Quieter areas inside a surface: wells, placeholders, selected rows. */
  "surface-sunken",
  /** A surface under the pointer (secondary buttons on hover). */
  "surface-hover",
  /** Hairline borders and dividers. */
  "line",
  /** Main text, and small marks that sit with text (dots, bars). */
  "ink",
  /** Strong fills: primary buttons, selected chips and tabs, toasts, the logo. */
  "ink-strong",
  /** A strong fill under the pointer. */
  "ink-strong-hover",
  /** Text and icons on an `ink-strong` fill. */
  "on-ink",
  /** The accent when it sits on an `ink-strong` fill (counts, ticks). */
  "accent-on-ink",
  /** Secondary text, captions, placeholders. */
  "muted",
  /** The brand accent: highlights, focus, selected states. */
  "accent",
  /** Text and icons on an `accent` fill. */
  "on-accent",
  /** Keyboard focus rings and focused field borders. At least 3:1 against surfaces. */
  "focus",
  /** "Something is in progress", e.g. a video rendering. */
  "progress",
  "success",
  "danger",
  /** Behind videos and their placeholders. Stays dark in every theme, like a screen. */
  "media",
  /** Text and icons on `media`. */
  "on-media",
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

/** Elevation levels, smallest first. */
export const SHADOW_TOKENS = ["card", "raised", "float", "pop", "fab", "hero"] as const;
export type ShadowToken = (typeof SHADOW_TOKENS)[number];

/** Corner radii, matching Tailwind's scale names so `rounded-xl` etc. follow the theme. */
export const RADIUS_TOKENS = ["sm", "md", "lg", "xl", "2xl"] as const;
export type RadiusToken = (typeof RADIUS_TOKENS)[number];

export type Theme = {
  id: string;
  label: string;
  /** Light or dark: sets the browser's own controls (scrollbars, date pickers) to match. */
  scheme: "light" | "dark";
  colors: Record<ColorToken, string>;
  /** The colour shadows are made of, as "r, g, b". */
  shadowRgb: string;
  radius: Record<RadiusToken, string>;
};

/** Shadow shapes. The colour comes from the theme's shadowRgb, the strength from here. */
export const SHADOWS: Record<ShadowToken, { shape: string; alpha: number }> = {
  card: { shape: "0 1px 2px", alpha: 0.04 },
  raised: { shape: "0 8px 24px -12px", alpha: 0.25 },
  float: { shape: "0 8px 24px -12px", alpha: 0.35 },
  pop: { shape: "0 12px 32px -12px", alpha: 0.35 },
  fab: { shape: "0 8px 20px -6px", alpha: 0.5 },
  hero: { shape: "0 20px 40px -20px", alpha: 0.25 },
};

const TAILWIND_RADIUS: Record<RadiusToken, string> = {
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
};

/** Atelier Light: warm paper, espresso ink, sand-gold accent. The default theme. */
export const atelierLight: Theme = {
  id: "atelier-light",
  label: "Atelier Light",
  scheme: "light",
  colors: {
    canvas: "#f4f1ed",
    surface: "#fbf9f6",
    "surface-sunken": "#ede5da",
    "surface-hover": "#ffffff",
    line: "#e3dcd3",
    ink: "#201e1c",
    "ink-strong": "#393025",
    "ink-strong-hover": "#201e1c",
    "on-ink": "#fbf9f6",
    "accent-on-ink": "#e9c79e",
    muted: "#8a7e76",
    accent: "#e9c79e",
    "on-accent": "#201e1c",
    progress: "#ff933c",
    success: "#12996b",
    danger: "#b4233c",
    focus: "#a8763a",
    media: "#201e1c",
    "on-media": "#fbf9f6",
  },
  shadowRgb: "32, 30, 28",
  radius: TAILWIND_RADIUS,
};

/** Atelier Dark: the same studio at night. Charcoal surfaces, sand-gold buttons. */
export const atelierDark: Theme = {
  id: "atelier-dark",
  label: "Atelier Dark",
  scheme: "dark",
  colors: {
    canvas: "#201e1c",
    surface: "#2a2724",
    "surface-sunken": "#1a1816",
    "surface-hover": "#33302c",
    line: "#3d3832",
    ink: "#f4f1ed",
    "ink-strong": "#e9c79e",
    "ink-strong-hover": "#f2d8b8",
    "on-ink": "#201e1c",
    "accent-on-ink": "#5c4630",
    muted: "#b3a69e",
    accent: "#e9c79e",
    "on-accent": "#201e1c",
    progress: "#ff933c",
    success: "#3fbf8f",
    danger: "#f0707f",
    focus: "#e9c79e",
    media: "#141210",
    "on-media": "#f4f1ed",
  },
  shadowRgb: "0, 0, 0",
  radius: TAILWIND_RADIUS,
};

/** Blueprint: cool drafting paper, cobalt buttons, highlighter-yellow accent, sharp corners. */
export const blueprint: Theme = {
  id: "blueprint",
  label: "Blueprint",
  scheme: "light",
  colors: {
    canvas: "#eef2f6",
    surface: "#ffffff",
    "surface-sunken": "#e5e9ed",
    "surface-hover": "#f6fafe",
    line: "#d3d8e2",
    ink: "#171c1f",
    "ink-strong": "#1f4fd8",
    "ink-strong-hover": "#0037b1",
    "on-ink": "#ffffff",
    "accent-on-ink": "#fed74c",
    muted: "#5d6070",
    accent: "#fed74c",
    "on-accent": "#171c1f",
    progress: "#e07b00",
    success: "#006b44",
    danger: "#ba1a1a",
    focus: "#1f4fd8",
    media: "#171c1f",
    "on-media": "#ffffff",
  },
  shadowRgb: "23, 28, 31",
  radius: { sm: "0.125rem", md: "0.1875rem", lg: "0.25rem", xl: "0.375rem", "2xl": "0.5rem" },
};

/** Grove: misty sage, deep teal buttons, tangerine accent, soft round corners. */
export const grove: Theme = {
  id: "grove",
  label: "Grove",
  scheme: "light",
  colors: {
    canvas: "#f2f6f3",
    surface: "#ffffff",
    "surface-sunken": "#ddebe3",
    "surface-hover": "#f7faf8",
    line: "#dce5e0",
    ink: "#10201f",
    "ink-strong": "#0f4c4a",
    "ink-strong-hover": "#165f5c",
    "on-ink": "#ffffff",
    "accent-on-ink": "#ffb27f",
    muted: "#5c6b69",
    accent: "#ff8a3d",
    "on-accent": "#10201f",
    progress: "#ff8a3d",
    success: "#0f7a55",
    danger: "#c2415b",
    focus: "#0f4c4a",
    media: "#10201f",
    "on-media": "#ffffff",
  },
  shadowRgb: "15, 76, 74",
  radius: { sm: "0.375rem", md: "0.5rem", lg: "0.75rem", xl: "1rem", "2xl": "1.25rem" },
};

export const THEMES: Theme[] = [atelierLight, atelierDark, blueprint, grove];
export const DEFAULT_THEME = atelierLight;
/** "Match my device" uses these two. */
export const SYSTEM_THEMES = { light: atelierLight, dark: atelierDark };

/** The CSS custom properties for one theme. */
function themeVars(t: Theme): string[] {
  return [
    `color-scheme: ${t.scheme};`,
    ...COLOR_TOKENS.map((c) => `--cg-${c}: ${t.colors[c]};`),
    `--cg-shadow-rgb: ${t.shadowRgb};`,
    ...RADIUS_TOKENS.map((r) => `--cg-radius-${r}: ${t.radius[r]};`),
  ];
}

/** The generated stylesheet: Tailwind theme names bound to the variables, then each theme's values. */
export function tokensCss(): string {
  const indent = (lines: string[]) => lines.map((l) => `  ${l}`).join("\n");
  const bindings = [
    ...COLOR_TOKENS.map((c) => `--color-${c}: var(--cg-${c});`),
    ...SHADOW_TOKENS.map((s) => `--shadow-${s}: ${SHADOWS[s].shape} rgba(var(--cg-shadow-rgb), ${SHADOWS[s].alpha});`),
    ...RADIUS_TOKENS.map((r) => `--radius-${r}: var(--cg-radius-${r});`),
  ];
  const blocks = [
    `/* Generated from src/design/tokens.ts (contract v${TOKENS_VERSION}) by \`npm run tokens\`. Do not edit by hand. */`,
    "",
    "@theme inline {",
    indent(bindings),
    "}",
    "",
    `:root {\n  --cg-tokens-version: "${TOKENS_VERSION}";\n${indent(themeVars(DEFAULT_THEME))}\n}`,
  ];
  for (const t of THEMES) blocks.push("", `[data-theme="${t.id}"] {\n${indent(themeVars(t))}\n}`);
  blocks.push(
    "",
    `[data-theme="system"] {\n${indent(themeVars(SYSTEM_THEMES.light))}\n}`,
    "",
    `@media (prefers-color-scheme: dark) {\n  [data-theme="system"] {\n${indent(indent(themeVars(SYSTEM_THEMES.dark)).split("\n"))}\n  }\n}`,
  );
  return blocks.join("\n") + "\n";
}
