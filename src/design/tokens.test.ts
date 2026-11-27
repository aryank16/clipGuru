import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, DEFAULT_THEME, RADIUS_TOKENS, THEMES, TOKENS_VERSION, tokensCss } from "./tokens";

const CSS_FILE = join(__dirname, "../app/tokens.css");

/** Files that may hold raw colours: the contract itself, the generated CSS, and third-party brand marks. */
const ALLOWED = [/src\/design\//, /src\/app\/tokens\.css$/, /src\/components\/auth\/parts\.tsx$/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx|ts|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("design tokens", () => {
  it("tokens.css is generated from tokens.ts (run `npm run tokens` after changing the contract)", () => {
    if (process.env.UPDATE_TOKENS) writeFileSync(CSS_FILE, tokensCss());
    expect(readFileSync(CSS_FILE, "utf8")).toBe(tokensCss());
  });

  it("every theme fills every token, with a unique id", () => {
    expect(TOKENS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    expect(THEMES).toContain(DEFAULT_THEME);
    for (const t of THEMES) {
      expect(Object.keys(t.colors).sort()).toEqual([...COLOR_TOKENS].sort());
      expect(Object.keys(t.radius).sort()).toEqual([...RADIUS_TOKENS].sort());
      for (const v of Object.values(t.colors)) expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("screens use tokens, never raw colours", () => {
    const root = join(__dirname, "..");
    const offenders: string[] = [];
    for (const f of [...files(join(root, "app")), ...files(join(root, "components"))]) {
      if (ALLOWED.some((re) => re.test(f))) continue;
      const src = readFileSync(f, "utf8");
      const raw = src.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])|rgba?\(\s*\d|hsla?\(\s*\d|\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:white|black|(?:gray|zinc|neutral|stone|slate|red|green|blue|amber|orange|yellow|emerald|sky|indigo|violet|pink|rose)-\d{2,3})\b/g);
      if (raw) offenders.push(`${f.slice(root.length + 1)}: ${[...new Set(raw)].join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });
});
