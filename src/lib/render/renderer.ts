import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { VideoProps } from "@/video/types";
import type { Storage } from "../storage";

/** What a poll of a running render reports. */
export type RenderPoll =
  | { state: "running"; progress: number }
  | { state: "done" }
  | { state: "failed"; message: string };

/**
 * The machine that turns props into an MP4 (Vercel Sandbox in production). Split into steps so the
 * background job can run each one in its own short request and pick up where it left off.
 */
export interface Renderer {
  /** Starts a machine with the video code on it. */
  setup(): Promise<{ sandboxId: string }>;
  /** Starts the render in the background on that machine. */
  start(sandboxId: string, props: VideoProps): Promise<{ cmdId: string }>;
  poll(sandboxId: string, cmdId: string): Promise<RenderPoll>;
  /** Uploads the finished video and a JPEG of each still (the cover choices) to storage. Returns the video size in bytes. */
  save(
    sandboxId: string,
    out: { props: VideoProps; videoKey: string; stills: { key: string; frame: number }[]; storage: Storage },
  ): Promise<{ bytes: number }>;
  /** Shuts the machine down. Never throws. */
  stop(sandboxId: string): Promise<void>;
}

export const COMPOSITION_ID = "Explainer";

// ── Vercel Sandbox ───────────────────────────────────────────────────────────

/** Built by scripts/bundle-video.mjs before `next build`. */
const BUNDLE_DIR = path.join(process.cwd(), ".remotion-bundle");
const SERVE_URL = "/vercel/sandbox/remotion-bundle";
const OUTPUT = "/tmp/video.mp4";
const still = (i: number) => `/tmp/still-${i}.jpg`;

/**
 * The settings @remotion/vercel's render script reads (same fields renderMediaOnVercel sends).
 * We start that script ourselves, detached and without Vercel Blob, because our files go to R2.
 * Pinned to @remotion/vercel 4.0.541: check this list when upgrading.
 */
function renderConfig(props: VideoProps) {
  return {
    serveUrl: SERVE_URL,
    compositionId: COMPOSITION_ID,
    inputProps: props,
    outputLocation: OUTPUT,
    codec: "h264",
    crf: null,
    imageFormat: null,
    pixelFormat: null,
    envVariables: {},
    frameRange: null,
    everyNthFrame: 1,
    proResProfile: null,
    chromiumOptions: {},
    scale: 1,
    preferLossless: false,
    enforceAudioTrack: false,
    disallowParallelEncoding: false,
    disableSharedMemoryCapture: false,
    concurrency: null,
    metadata: null,
    licenseKey: null,
    isProduction: null,
    videoBitrate: null,
    audioBitrate: null,
    encodingMaxRate: null,
    encodingBufferSize: null,
    muted: false,
    numberOfGifLoops: null,
    x264Preset: null,
    gopSize: null,
    colorSpace: "default",
    jpegQuality: 80,
    audioCodec: null,
    logLevel: "info",
    timeoutInMilliseconds: 60_000,
    forSeamlessAacConcatenation: false,
    separateAudioTo: null,
    hardwareAcceleration: "disable",
    offthreadVideoCacheSizeInBytes: null,
    mediaCacheSizeInBytes: null,
    preferredEffectBackend: "auto",
    offthreadVideoThreads: null,
    chromeMode: "headless-shell",
    browserExecutable: null,
    binariesDirectory: null,
    repro: false,
    sampleRate: 48000,
    vercelBlob: null,
  };
}

/** Uploads a file from the sandbox to a signed R2 link with curl. */
async function upload(
  sandbox: import("@vercel/sandbox").Sandbox,
  file: string,
  putUrl: string,
  contentType: string,
): Promise<number> {
  const cmd = await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", 'curl -fsS --retry 2 -X PUT -H "content-type: $TYPE" --upload-file "$FILE" "$URL" && stat -c %s "$FILE"'],
    env: { URL: putUrl, FILE: file, TYPE: contentType },
  });
  if (cmd.exitCode !== 0) throw new Error(`Upload of ${file} failed: ${(await cmd.stderr()).slice(0, 300)}`);
  return Number((await cmd.stdout()).trim()) || 0;
}

export function sandboxRenderer(): Renderer {
  return {
    async setup() {
      const { createSandbox, addBundleToSandbox } = await import("@remotion/vercel");
      // Installs Chrome, FFmpeg and the renderer; the sandbox lives 15 minutes unless extended.
      const sandbox = await createSandbox({ resources: { vcpus: 4 }, timeoutInMilliseconds: 15 * 60_000 });
      try {
        // addBundleToSandbox (4.0.541) creates the bundle's subfolders but not the root folder itself.
        await sandbox.mkDir("remotion-bundle");
        await addBundleToSandbox({ sandbox, bundleDir: BUNDLE_DIR });
      } catch (err) {
        await sandbox.stop().catch(() => undefined);
        throw err;
      }
      return { sandboxId: sandbox.sandboxId };
    },

    async start(sandboxId, props) {
      const { Sandbox } = await import("@vercel/sandbox");
      const sandbox = await Sandbox.get({ sandboxId });
      const cmd = await sandbox.runCommand({
        cmd: "node",
        args: ["render-video.mjs", JSON.stringify(renderConfig(props))],
        detached: true,
      });
      await sandbox.extendTimeout(20 * 60_000);
      return { cmdId: cmd.cmdId };
    },

    async poll(sandboxId, cmdId) {
      const { Sandbox } = await import("@vercel/sandbox");
      const { getRenderProgress } = await import("@remotion/vercel");
      const progress = await getRenderProgress({ sandboxId, cmdId });
      if (progress.stage === "expired") return { state: "failed", message: "The renderer stopped before the video was done." };
      if (progress.stage === "error") return { state: "failed", message: progress.message };
      // The render script writes "done" to its progress file once the MP4 is on disk, but its process
      // doesn't always exit after that, so the file (not the exit code) says when it's finished.
      if (progress.stage === "done") return { state: "done" };
      const cmd = await (await Sandbox.get({ sandboxId })).getCommand(cmdId);
      if (cmd.exitCode === 0) return { state: "done" };
      return { state: "running", progress: "overallProgress" in progress ? progress.overallProgress : 0 };
    },

    async save(sandboxId, { props, videoKey, stills, storage }) {
      const { Sandbox } = await import("@vercel/sandbox");
      const { renderStillOnVercel } = await import("@remotion/vercel");
      const sandbox = await Sandbox.get({ sandboxId });
      const videoUrl = await storage.signedPutUrl(videoKey);
      if (!videoUrl) throw new Error("The render sandbox needs R2 storage.");
      const bytes = await upload(sandbox, OUTPUT, videoUrl, "video/mp4");
      for (const [i, s] of stills.entries()) {
        const putUrl = await storage.signedPutUrl(s.key);
        if (!putUrl) throw new Error("The render sandbox needs R2 storage.");
        await renderStillOnVercel({
          sandbox,
          compositionId: COMPOSITION_ID,
          inputProps: props,
          frame: s.frame,
          imageFormat: "jpeg",
          jpegQuality: 85,
          outputFile: still(i),
        });
        await upload(sandbox, still(i), putUrl, "image/jpeg");
      }
      return { bytes };
    },

    async stop(sandboxId) {
      try {
        const { Sandbox } = await import("@vercel/sandbox");
        await (await Sandbox.get({ sandboxId })).stop();
      } catch {
        // Already stopped or expired.
      }
    },
  };
}

// ── Fake (local end-to-end tests) ────────────────────────────────────────────

/** How long a fake render takes. A storyboard whose narration says "renderfail" fails halfway. */
const FAKE_MS = 4000;
const g = globalThis as unknown as { __fakeRenders?: Map<string, { started: number; fail: boolean }> };
const fakes = (g.__fakeRenders ??= new Map());

const STILL_COLORS = ["#393025", "#8A7E76", "#E9C79E"];
function fakeStill(i: number, frame: number): Uint8Array {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960"><rect width="540" height="960" fill="${STILL_COLORS[i % 3]}"/><text x="270" y="470" font-family="sans-serif" font-size="56" font-weight="700" text-anchor="middle" fill="#FBF9F6">Cover ${i + 1}</text><text x="270" y="540" font-family="monospace" font-size="28" text-anchor="middle" fill="#FBF9F6">frame ${frame}</text></svg>`;
  return new TextEncoder().encode(svg);
}

export function fakeRenderer(ms = FAKE_MS): Renderer {
  return {
    async setup() {
      return { sandboxId: `fake-${Math.random().toString(36).slice(2)}` };
    },
    async start(sandboxId, props) {
      const fail = props.storyboard.scenes.some((s) => /renderfail/i.test(s.narration));
      fakes.set(sandboxId, { started: Date.now(), fail });
      return { cmdId: "render" };
    },
    async poll(sandboxId) {
      const f = fakes.get(sandboxId);
      if (!f) return { state: "failed", message: "The renderer stopped before the video was done." };
      const p = (Date.now() - f.started) / ms;
      if (f.fail && p >= 0.5) return { state: "failed", message: "Frame 120 could not be drawn (test failure)." };
      return p >= 1 ? { state: "done" } : { state: "running", progress: p };
    },
    async save(_sandboxId, { videoKey, stills, storage }) {
      const dir = path.join(process.cwd(), "src/lib/render");
      const video = await readFile(path.join(dir, "fake-video.mp4"));
      await storage.put(videoKey, video, "video/mp4");
      // Each still differs, so choosing a cover visibly changes something in local tests.
      for (const [i, s] of stills.entries()) await storage.put(s.key, fakeStill(i, s.frame), "image/svg+xml");
      return { bytes: video.byteLength };
    },
    async stop(sandboxId) {
      fakes.delete(sandboxId);
    },
  };
}
