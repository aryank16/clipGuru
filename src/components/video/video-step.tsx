"use client";

import { AlertTriangle, ArrowLeft, Check, Clock, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StepTabs } from "@/components/idea/step-tabs";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/projects/types";
import { RENDER_STAGES, STAGE_LABELS, type Render, type RenderStage } from "@/lib/render/types";
import { formatDuration } from "@/lib/storyboard/types";

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
      <StepTabs current="video" projectId={project.id} hasStoryboard hasVideo />

      <header className="flex flex-col gap-3 border-b border-hairline pb-6">
        <span className="eyebrow flex items-center gap-2">
          {running && <span className="size-2 rounded-full bg-render-orange" aria-hidden />}
          Step 3 · Video · {render.status === "ready" ? "Ready" : render.status === "failed" ? "Needs attention" : render.stageLabel}
        </span>
        <h1 className="break-words font-display text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {render.status === "ready" ? "Your video is ready" : render.status === "failed" ? "The video didn’t finish" : "Making your video"}
        </h1>
        <p className="max-w-2xl text-taupe">{project.title}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <section
          aria-label="Video"
          className="mx-auto flex w-full max-w-[min(22.5rem,calc((100dvh-14rem)*9/16))] flex-col gap-3 lg:mx-0 lg:max-w-none"
        >
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl border border-hairline bg-surface-warm/60">
            {render.status === "ready" && render.videoUrl ? (
              <video
                src={render.videoUrl}
                poster={render.thumbnailUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 size-full bg-espresso object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle,rgba(138,126,118,0.18)_1px,transparent_1px)] [background-size:18px_18px] p-6 text-center">
                <span
                  className={cn(
                    "flex size-16 items-center justify-center rounded-xl text-sand-gold",
                    render.status === "failed" ? "bg-danger/10 text-danger" : "bg-espresso",
                  )}
                  aria-hidden
                >
                  {render.status === "failed" ? <AlertTriangle className="size-7" /> : <Loader2 className="size-7 animate-spin" />}
                </span>
                <span className="font-display text-lg font-black uppercase tracking-tight">
                  {render.status === "failed" ? "Stopped" : `${pct}%`}
                </span>
                <span className="font-mono text-xs uppercase tracking-wider text-taupe">9:16 · 1080 × 1920</span>
              </div>
            )}
          </div>
          {render.status === "ready" && (
            <p className="flex items-center justify-center gap-1.5 font-mono text-xs uppercase tracking-wider text-taupe">
              <Clock className="size-3.5" aria-hidden />
              {render.durationSec ? formatDuration(Math.round(render.durationSec)) : "—"} · 9:16 vertical
            </p>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          {render.status !== "ready" && (
            <section aria-label="Progress" className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow flex items-center gap-2">
                  <Clock className="size-4" aria-hidden /> {render.status === "failed" ? "Stopped" : "Usually 2 to 4 minutes"}
                </span>
                <span className="rounded bg-surface-warm px-2 py-0.5 font-mono text-xs font-semibold" aria-live="polite">
                  {pct}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Video progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="h-2 overflow-hidden rounded-full bg-hairline"
              >
                <div
                  className={cn("h-full rounded-full transition-[width] duration-700", render.status === "failed" ? "bg-danger/60" : "bg-sand-gold")}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
              <p className="text-sm text-taupe" role="status">
                {offline
                  ? "Can’t reach ClipGuru right now. The video keeps going; this page catches up when you’re back online."
                  : render.status === "failed"
                    ? "Trying again reuses the voiceover, so it starts faster."
                    : "You can leave this page. The video keeps going and shows up in My videos when it’s done."}
              </p>
            </section>
          )}

          {render.status === "failed" && render.error && (
            <section role="alert" className="flex flex-col gap-4 rounded-xl border border-sand-gold bg-sand-gold/15 p-5 sm:p-6">
              <div className="flex flex-col gap-1">
                <span className="font-medium">Stopped at: {STAGE_LABELS[render.error.stage].toLowerCase()}</span>
                <span className="text-sm text-espresso/80">{render.error.message}</span>
              </div>
              <Button onClick={retry} disabled={retrying} aria-busy={retrying} className="w-fit">
                {retrying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
                Try again
              </Button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </section>
          )}

          {render.status === "ready" ? (
            <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-5 sm:p-6">
              <p className="flex items-center gap-2 font-medium">
                <Check className="size-5 text-success" aria-hidden /> Made from storyboard version {render.version}.
              </p>
              {outdated ? (
                <p className="text-sm text-taupe">
                  You’ve changed the storyboard since. Open it and press Generate video to make the new version.
                </p>
              ) : (
                <p className="text-sm text-taupe">Downloading and posting to Instagram come in the next updates.</p>
              )}
            </section>
          ) : (
            <Stages render={render} />
          )}

          <Link href={`/videos/${project.id}/storyboard`} className={buttonClasses("secondary", "md", "w-fit")}>
            <ArrowLeft className="size-4" /> Back to storyboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stages({ render }: { render: Render }) {
  const current = RENDER_STAGES.indexOf(render.stage);
  return (
    <section aria-label="Steps" className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-5 sm:p-6">
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
                now && !failed ? "border-sand-gold bg-sand-gold/10" : "border-hairline",
                !done && !now && "border-dashed opacity-70",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                  done ? "bg-espresso text-sand-gold" : failed ? "bg-danger/10 text-danger" : now ? "bg-render-orange/20 text-render-orange" : "bg-surface-warm text-taupe",
                )}
                aria-hidden
              >
                {done ? <Check className="size-4" /> : failed ? <AlertTriangle className="size-4" /> : now ? <Loader2 className="size-4 animate-spin" /> : <span className="size-1.5 rounded-full bg-taupe" />}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-x-2 font-medium">
                  {STAGE_LABELS[s]}
                  <span className="font-mono text-[11px] uppercase tracking-wider text-taupe">
                    {done ? "Done" : failed ? "Stopped" : now ? "In progress" : "Waiting"}
                  </span>
                </span>
                <span className="text-sm text-taupe">{STAGE_NOTES[s]}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
