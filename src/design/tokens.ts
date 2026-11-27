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

export const TOKENS_VERSION = "1.0.0";

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
  /** Main text, and the fill of primary buttons. */
  "ink",
  /** Hover and pressed state of `ink` fills. */
  "ink-strong",
  /** Text and icons on an `ink` fill. */
  "on-ink",
  /** Secondary text, captions, placeholders. */
  "muted",
  /** The brand accent: highlights, focus, selected states. */
  "accent",
  /** Text and icons on an `accent` fill. */
  "on-accent",
  /** "Something is in progress", e.g. a video rendering. */
  "progress",
  "success",
  "danger",
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
    "on-ink": "#fbf9f6",
    muted: "#8a7e76",
    accent: "#e9c79e",
    "on-accent": "#201e1c",
    progress: "#ff933c",
    success: "#12996b",
    danger: "#b4233c",
  },
  shadowRgb: "32, 30, 28",
  radius: TAILWIND_RADIUS,
};

export const THEMES: Theme[] = [atelierLight];
export const DEFAULT_THEME = atelierLight;

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
  return blocks.join("\n") + "\n";
}
