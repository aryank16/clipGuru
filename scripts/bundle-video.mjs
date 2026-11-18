// Bundles the video composition (src/remotion) for the server-side renderer.
// Runs before `next build`; the render job copies .remotion-bundle into a Vercel Sandbox.
import { bundle } from "@remotion/bundler";
import path from "node:path";
import { rm } from "node:fs/promises";

const root = process.cwd();
const outDir = path.join(root, ".remotion-bundle");
await rm(outDir, { recursive: true, force: true });
const started = Date.now();
await bundle({
  entryPoint: path.join(root, "src/remotion/index.ts"),
  outDir,
  publicDir: path.join(root, "public"),
  enableCaching: false,
  webpackOverride: (config) => ({
    ...config,

    resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), "@": path.join(root, "src") } },
  }),
});
console.log(`[bundle-video] .remotion-bundle ready in ${((Date.now() - started) / 1000).toFixed(1)} s`);
