"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, Download, Info, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StepTabs } from "@/components/idea/step-tabs";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { canPost, type Project } from "@/lib/projects/types";
import { RENDER_STAGES, STAGE_LABELS, type Render, type RenderStage } from "@/lib/render/types";
import { formatDuration } from "@/lib/storyboard/types";
import { VOICES } from "@/lib/voices";

const POLL_MS = 2000;

const STAGE_NOTES: Record<RenderStage, string> = {
  voice: "The narration, with a timing for every word.",
  setup: "A fresh machine with the video code and fonts.",
  render: "Every frame drawn at 1080 × 1920, 30 fps, with captions.",
  finish: "The MP4 and a thumbnail go to your library.",
};

const active = (r: Render) => r.status === "queued" || r.status === "running";

/** Step 3: progress while the video is made, then the finished video (design: 08 and 09). */
export function VideoStep({ project, initialRender }: { project: Project; initialRender: Render }) {
  const [render, setRender] = useState(initialRender);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const router = useRouter();
  const running = active(render);

  // Poll while it runs. A failed poll (offline, a deploy) just tries again next time.
  useEffect(() => {
    if (!running) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/renders/${render.id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const { render: next } = (await res.json()) as { render: Render };
        if (!stop) {
          setOffline(false);
          setRender(next);
        }
      } catch {
        if (!stop) setOffline(true);
      }
    };
    const t = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [running, render.id]);

  // The library and step tabs read the project status, which the job changes when it finishes.
  const finished = !running;
  useEffect(() => {
    if (finished && initialRender.status !== render.status) router.refresh();
  }, [finished, initialRender.status, render.status, router]);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/renders/${render.id}/retry`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't try again. Reload the page.");
      setRender(data.render);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }

  const pct = Math.round(render.progress * 100);
  const outdated = render.status === "ready" && render.version !== project.currentVersion;

  return (
    <div className="flex flex-col gap-6 lg:gap-10">
      <StepTabs current="video" projectId={project.id} hasStoryboard hasVideo canPost={render.status === "ready" || canPost(project)} />

      <header className="flex flex-col gap-3 border-b border-line pb-6">
        <span className="eyebrow flex items-center gap-2">
          {running && <span className="size-2 rounded-full bg-progress" aria-hidden />}
          Step 3 · Video · {render.status === "ready" ? "Ready" : render.status === "failed" ? "Needs attention" : render.stageLabel}
        </span>
        <h1 className="break-words font-display text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {render.status === "ready" ? "Your video is ready" : render.status === "failed" ? "The video didn’t finish" : "Making your video"}
        </h1>
        {/* One line on a phone, so the player still fits above the tab bar. */}
        <p className={cn("max-w-2xl text-muted", render.status === "ready" && "truncate sm:whitespace-normal")}>
          {render.status === "ready"
            ? `“${project.title}” is made${render.durationSec ? `: ${formatDuration(Math.round(render.durationSec))} long` : ""}, ready to download.`
            : project.title}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <section
          aria-label="Video"
          className="mx-auto flex w-full max-w-[min(22.5rem,calc((100dvh-26.5rem)*9/16))] flex-col gap-3 lg:mx-0 lg:max-w-none"
        >
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl border border-line bg-surface-sunken/60">
            {render.status === "ready" && render.videoUrl ? (
              <video
                src={render.videoUrl}
                poster={render.thumbnailUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 size-full bg-ink object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-muted)_18%,transparent)_1px,transparent_1px)] [background-size:18px_18px] p-6 text-center">
                <span
                  className={cn(
                    "flex size-16 items-center justify-center rounded-xl text-accent",
                    render.status === "failed" ? "bg-danger/10 text-danger" : "bg-ink",
                  )}
                  aria-hidden
                >
                  {render.status === "failed" ? <AlertTriangle className="size-7" /> : <Loader2 className="size-7 animate-spin" />}
                </span>
                <span className="font-display text-lg font-black uppercase tracking-tight">
                  {render.status === "failed" ? "Stopped" : `${pct}%`}
                </span>
                <span className="font-mono text-xs uppercase tracking-wider text-muted">9:16 · 1080 × 1920</span>
              </div>
            )}
          </div>
          {render.status === "ready" && (
            <p className="flex items-center justify-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted lg:justify-start">
              <Info className="size-3.5" aria-hidden />
              Made at full 1080 × 1920, the Instagram Reel size
            </p>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          {render.status !== "ready" && (
            <section aria-label="Progress" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow flex items-center gap-2">
                  <Clock className="size-4" aria-hidden /> {render.status === "failed" ? "Stopped" : "Usually 2 to 4 minutes"}
                </span>
                <span className="rounded bg-surface-sunken px-2 py-0.5 font-mono text-xs font-semibold" aria-live="polite">
                  {pct}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Video progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="h-2 overflow-hidden rounded-full bg-line"
              >
                <div
                  className={cn("h-full rounded-full transition-[width] duration-700", render.status === "failed" ? "bg-danger/60" : "bg-accent")}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
              <p className="text-sm text-muted" role="status">
                {offline
                  ? "Can’t reach ClipGuru right now. The video keeps going; this page catches up when you’re back online."
                  : render.status === "failed" && render.error?.code === "VOICE_CREDITS_USED_UP"
                    ? "Trying again won’t work until the voice credits reset."
                    : render.status === "failed"
                      ? "Trying again reuses the voiceover, so it starts faster."
                      : "You can leave this page. The video keeps going and shows up in My videos when it’s done."}
              </p>
            </section>
          )}

          {render.status === "failed" && render.error && (
            <section role="alert" className="flex flex-col gap-4 rounded-xl border border-accent bg-accent/15 p-5 sm:p-6">
              <div className="flex flex-col gap-1">
                <span className="font-medium">Stopped at: {STAGE_LABELS[render.error.stage].toLowerCase()}</span>
                <span className="text-sm text-ink/80">{render.error.message}</span>
              </div>
              <Button onClick={retry} disabled={retrying} aria-busy={retrying} className="w-fit">
                {retrying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
                Try again
              </Button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </section>
          )}

          {render.status === "ready" ? (
            <Ready render={render} projectId={project.id} outdated={outdated} onChange={setRender} />
          ) : (
            <>
              <Stages render={render} />
              <Link href={`/videos/${project.id}/storyboard`} className={buttonClasses("secondary", "md", "w-fit")}>
                <ArrowLeft className="size-4" /> Back to storyboard
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const formatBytes = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

/** The finished video: its details, the cover choice, download (design: 09). */
function Ready({
  render,
  projectId,
  outdated,
  onChange,
}: {
  render: Render;
  projectId: string;
  outdated: boolean;
  onChange: (r: Render) => void;
}) {
  const voice = VOICES.find((v) => v.id === render.voiceId) ?? VOICES[0];
  const rows: [string, string][] = [
    ["Length", render.durationSec ? formatDuration(Math.round(render.durationSec)) : "—"],
    ["Voice", `${voice.name} (${voice.accent} ${voice.gender})`],
    ["Size", "1080 × 1920 px, 9:16"],
    ["Format", "MP4 · H.264 · 30 fps"],
  ];
  if (render.bytes) rows.push(["File size", formatBytes(render.bytes)]);

  return (
    <>
      {outdated && (
        <p role="status" className="order-first rounded-xl border border-accent bg-accent/15 p-4 text-sm lg:order-none">
          You’ve changed the storyboard since this video was made (it’s version {render.version}). Open the storyboard and
          press Generate video to make the new version.
        </p>
      )}

      <section aria-labelledby="details-h" className="flex flex-col rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <h2 id="details-h" className="font-mono text-xs font-semibold uppercase tracking-wider">
            Details
          </h2>
          <span className="rounded border border-line px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted">MP4</span>
        </div>
        <dl className="flex flex-col">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0 last:pb-0">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {render.covers.length > 1 && <CoverPicker render={render} onChange={onChange} />}

      {/* On a phone the button sits right under the player; on a wide screen after the details (design 09). */}
      <div className="order-first flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:order-none">
        {render.downloadUrl && (
          <a href={render.downloadUrl} download className={buttonClasses("primary", "lg", "w-full sm:w-auto")}>
            <Download className="size-5" aria-hidden /> Download MP4
          </a>
        )}
        <Link href={`/videos/${projectId}/post`} className={buttonClasses("secondary", "lg", "w-full sm:w-auto")}>
          Continue to post <ArrowRight className="size-5" aria-hidden />
        </Link>
      </div>

      <Link
        href={`/videos/${projectId}/storyboard`}
        className="tap flex w-fit items-center gap-1.5 text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Edit storyboard and make it again <ArrowRight className="size-4" aria-hidden />
      </Link>
    </>
  );
}

/** Three suggested frames; the chosen one is the thumbnail (and the Reel cover). */
function CoverPicker({ render, onChange }: { render: Render; onChange: (r: Render) => void }) {
  const router = useRouter();
  // The pick shows at once; saves run one at a time, always ending on the latest pick
  // (two quick arrow presses move two steps).
  const [picked, setPicked] = useState(render.coverIndex);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const want = useRef(render.coverIndex);
  const saved = useRef(render.coverIndex);
  const busy = useRef(false);

  async function choose(i: number) {
    if (i === want.current) return;
    want.current = i;
    setPicked(i);
    setError(null);
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      while (want.current !== saved.current) {
        const next = want.current;
        const res = await fetch(`/api/renders/${render.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ coverIndex: next }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't change the cover. Try again.");
        saved.current = next;
        onChange(data.render);
      }
      router.refresh(); // My videos shows the new cover
    } catch (e) {
      want.current = saved.current;
      setPicked(saved.current);
      setError(e instanceof TypeError ? "Couldn’t reach ClipGuru. Check your connection and try again." : (e as Error).message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="cover-h" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="cover-h" className="font-mono text-xs font-semibold uppercase tracking-wider">
          Cover
        </h2>
        <p className="text-sm text-muted">The still people see before they press play. It’s also the thumbnail in My videos.</p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="cover-h"
        className="grid grid-cols-3 gap-3 sm:max-w-sm"
        onKeyDown={(e) => {
          const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          const n = render.covers.length;
          const next = (picked + step + n) % n;
          (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
          void choose(next);
        }}
      >
        {render.covers.map((c, i) => {
          const chosen = i === picked;
          return (
            <button
              key={c.url}
              type="button"
              role="radio"
              aria-checked={chosen}
              tabIndex={chosen ? 0 : -1}
              aria-label={`Cover ${i + 1}, at ${formatDuration(Math.round(c.offsetMs / 1000))}`}
              onClick={() => choose(i)}
              className={cn(
                "group relative aspect-[9/16] overflow-hidden rounded-lg border-2 bg-surface-sunken transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
                chosen ? "border-accent shadow-sm" : "border-transparent hover:border-line",

              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- private, signed image */}
              <img src={c.url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
              <span className="absolute inset-x-1 bottom-1 rounded bg-ink/80 px-1 py-0.5 text-center font-mono text-[10px] text-on-ink">
                {formatDuration(Math.round(c.offsetMs / 1000))}
              </span>
              {chosen && (
                <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
                  <Check className="size-3.5" />
                </span>
              )}
              {saving && chosen && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/30" aria-hidden>
                  <Loader2 className="size-5 animate-spin text-on-ink" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {saving ? "Saving the cover…" : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function Stages({ render }: { render: Render }) {
  const current = RENDER_STAGES.indexOf(render.stage);
  return (
    <section aria-label="Steps" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-black uppercase tracking-tight">How it’s made</h2>
      <ol className="flex flex-col gap-3">
        {RENDER_STAGES.map((s, i) => {
          const done = i < current;
          const now = i === current;
          const failed = now && render.status === "failed";
          return (
            <li
              key={s}
              aria-current={now ? "step" : undefined}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 sm:p-4",
                now && !failed ? "border-accent bg-accent/10" : "border-line",
                !done && !now && "border-dashed opacity-70",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                  done ? "bg-ink text-accent" : failed ? "bg-danger/10 text-danger" : now ? "bg-progress/20 text-progress" : "bg-surface-sunken text-muted",
                )}
                aria-hidden
              >
                {done ? <Check className="size-4" /> : failed ? <AlertTriangle className="size-4" /> : now ? <Loader2 className="size-4 animate-spin" /> : <span className="size-1.5 rounded-full bg-muted" />}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-x-2 font-medium">
                  {STAGE_LABELS[s]}
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    {done ? "Done" : failed ? "Stopped" : now ? "In progress" : "Waiting"}
                  </span>
                </span>
                <span className="text-sm text-muted">{STAGE_NOTES[s]}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
