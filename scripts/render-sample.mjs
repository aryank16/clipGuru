// Renders a silent sample video from a storyboard JSON, for judging the motion locally.
// Usage: node scripts/render-sample.mjs <storyboard.json> <out.mp4> [--scenes=0,2,5] [--frames=0-300]
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";

const [, , sbPath, out, ...flags] = process.argv;
const opt = Object.fromEntries(flags.map((f) => f.replace(/^--/, "").split("=")));
const root = process.cwd();
const storyboard = JSON.parse(await readFile(sbPath, "utf8"));
if (opt.scenes) storyboard.scenes = opt.scenes.split(",").map((i) => storyboard.scenes[Number(i)]);

// Even word timing at George's pace (~2.45 words a second), like the fake voice.
const words = [];
let t = 0.3;
for (const s of storyboard.scenes) {
  for (const w of s.narration.trim().split(/\s+/)) {
    words.push({ text: w, start: +t.toFixed(3), end: +(t + 0.33).toFixed(3) });
    t += 1 / 2.45;
  }
  t += 0.35;
}
const durationSec = +(t + 0.6).toFixed(2);
const inputProps = { storyboard, words, audioSrc: null, durationSec };

const serveUrl = await bundle({
  entryPoint: path.join(root, "src/remotion/index.ts"),
  publicDir: path.join(root, "public"),
  webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@": path.join(root, "src") } } }),
});
const browserExecutable = process.env.BROWSER || null;
const composition = await selectComposition({ serveUrl, id: "Explainer", inputProps, browserExecutable });
const frameRange = opt.frames ? opt.frames.split("-").map(Number) : undefined;
const started = Date.now();
await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: out, inputProps, frameRange, crf: 20, browserExecutable, licenseKey: null });
console.log(`rendered ${out} (${durationSec}s) in ${((Date.now() - started) / 1000).toFixed(0)}s`);
