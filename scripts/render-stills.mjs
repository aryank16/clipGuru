// Renders one still per scene (75% of the way in), for checking 3D shots quickly.
// Usage: BROWSER=<chrome-headless-shell> node scripts/render-stills.mjs <storyboard.json> <outdir> [0,2,5]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";
const [, , sbPath, outDir, only] = process.argv;
const root = process.cwd();
const storyboard = JSON.parse(await readFile(sbPath, "utf8"));
const words = []; let t = 0.3; const bounds = [];
for (const s of storyboard.scenes) { const a = t; for (const w of s.narration.trim().split(/\s+/)) { words.push({ text: w, start: +t.toFixed(3), end: +(t + 0.33).toFixed(3) }); t += 1 / 2.45; } t += 0.35; bounds.push([a, t]); }
const durationSec = +(t + 0.6).toFixed(2);
const inputProps = { storyboard, words, audioSrc: null, durationSec };
const serveUrl = await bundle({ entryPoint: path.join(root, "src/remotion/index.ts"), publicDir: path.join(root, "public"),
  webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@": path.join(root, "src") } } }) });
const browserExecutable = process.env.BROWSER || null;
const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps, browserExecutable, chromiumOptions: { gl: "swangle" } });
for (let i = 0; i < bounds.length; i++) {
  if (only && !only.split(",").includes(String(i))) continue;
  const [a, b] = bounds[i];
  const frame = Math.round((a + (b - a) * 0.75) * 30);
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, output: path.join(outDir, `s${i}.png`), frame, inputProps, browserExecutable, chromiumOptions: { gl: "swangle" }, imageFormat: "png" });
  console.log("still", i, frame, Date.now() - t0, "ms");
}
