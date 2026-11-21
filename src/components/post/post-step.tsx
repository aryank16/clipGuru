"use client";

import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  CalendarClock,
  Check,
  ExternalLink,
  Info,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StepTabs } from "@/components/idea/step-tabs";
import type { ConnectResult } from "@/components/instagram/instagram-section";
import { CONNECT_ERROR_TEXT } from "@/components/instagram/messages";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { InstagramStatus } from "@/lib/instagram/types";
import {
  CAPTION_MAX,
  HASHTAGS_MAX,
  LOCK_BEFORE_MS,
  SCHEDULE_MIN_MS,
  countHashtags,
  fullCaption,
  parseHashtags,
  type Post,
} from "@/lib/posts/types";
import type { Project } from "@/lib/projects/types";
import type { Render } from "@/lib/render/types";
import { formatDuration } from "@/lib/storyboard/types";
import { formatInZone, utcToZoned, zoneLabel, zonedToUtc } from "@/lib/zoned";

const POLL_MS = 3000;
const connectHref = (projectId: string) => `/api/instagram/connect?returnTo=${encodeURIComponent(`/videos/${projectId}/post`)}`;
const draftKey = (projectId: string) => `clipguru:caption:${projectId}`;

type Draft = { caption: string; hashtags: string };
type ApiErr = { code: string; message: string; details?: Record<string, unknown> };

function readDraft(projectId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(projectId));
    const d = raw ? (JSON.parse(raw) as Partial<Draft>) : null;
    return d && typeof d.caption === "string" && typeof d.hashtags === "string" ? { caption: d.caption, hashtags: d.hashtags } : null;
  } catch {
    return null;
  }
}
function writeDraft(projectId: string, d: Draft | null) {
  try {
    if (d) localStorage.setItem(draftKey(projectId), JSON.stringify(d));
    else localStorage.removeItem(draftKey(projectId));
  } catch {
    /* storage blocked: the draft just isn't kept */
  }
}

/** Tomorrow at 18:00 in the zone, as the date and time inputs want it. */
function defaultSlot(timeZone: string): { date: string; time: string } {
  const tomorrow = utcToZoned(new Date(Date.now() + 24 * 3600_000), timeZone);
  return { date: tomorrow.date, time: "18:00" };
}

function newKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw { code: "OFFLINE", message: "Couldn’t reach ClipGuru. Check your connection and try again." } satisfies ApiErr;
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw (data?.error ?? { code: "UNKNOWN", message: "Something went wrong. Try again." }) as ApiErr;
  return data as T;
}

/** Step 4: write the caption, then post now or schedule (designs 10 and 16). */
export function PostStep({
  project,
  render,
  initialPost,
  instagram,
  timeZone,
  connectResult,
}: {
  project: Project;
  render: Render;
  initialPost: Post | null;
  instagram: InstagramStatus;
  timeZone: string;
  connectResult: ConnectResult;
}) {
  const router = useRouter();
  const [post, setPost] = useState(initialPost);
  // Compose when there's no post yet, the last one was cancelled, or the person chose to post again.
  const [composing, setComposing] = useState(!initialPost || initialPost.status === "cancelled");
  const [now, setNow] = useState(() => Date.now());

  const status = post?.status;
  const due = post?.status === "scheduled" && new Date(post.scheduledAt).getTime() <= now;
  const watching = !composing && (status === "publishing" || due);

  // Follow a post that's going out (or whose time has come) until it settles.
  useEffect(() => {
    if (!watching || !post) return;
    let stop = false;
    const t = setInterval(async () => {
      try {
        const { post: next } = await call<{ post: Post }>(`/api/posts/${post.id}`);
        if (!stop) setPost(next);
      } catch {
        /* try again next tick */
      }
    }, POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [watching, post]);

  // A clock for "cancel until" and "due" checks.
  useEffect(() => {
    if (composing || status !== "scheduled") return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [composing, status]);

  // The library and step tabs read the project status, which changes when the post settles.
  const settled = status === "posted" || status === "failed" || status === "held";
  const firstStatus = useRef(initialPost?.status);
  useEffect(() => {
    if (settled && status !== firstStatus.current) {
      firstStatus.current = status;
      router.refresh();
    }
  }, [settled, status, router]);

  // The connect result came in the address; take it out so a reload doesn't show it again.
  useEffect(() => {
    if (connectResult && location.search) history.replaceState(history.state, "", location.pathname);
  }, [connectResult]);

  const outdated = render.version !== project.currentVersion;
  const ig = instagram;

  return (
    <div className="flex flex-col gap-6 lg:gap-10">
      <StepTabs current="post" projectId={project.id} hasStoryboard hasVideo canPost />

      <Header post={composing ? null : post} title={project.title} />

      {connectResult && (composing || !connectResult.ok) && <ConnectBanner result={connectResult} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <section
          aria-label="Video"
          className="mx-auto flex w-full max-w-[min(22.5rem,calc((100dvh-26.5rem)*9/16))] flex-col gap-3 lg:mx-0 lg:max-w-none"
        >
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl border border-hairline bg-espresso">
            {render.videoUrl && (
              <video
                src={render.videoUrl}
                poster={render.thumbnailUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 size-full object-contain"
              />
            )}
          </div>
          <p className="flex items-center justify-center gap-1.5 font-mono text-xs uppercase tracking-wider text-taupe lg:justify-start">
            <Info className="size-3.5" aria-hidden />
            Reel · 9:16{render.durationSec ? ` · ${formatDuration(Math.round(render.durationSec))}` : ""}
          </p>
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          {composing || !post ? (
            <Compose
              project={project}
              render={render}
              instagram={ig}
              timeZone={timeZone}
              outdated={outdated}
              previous={post}
              onPosted={(p) => {
                setPost(p);
                setComposing(false);
                setNow(Date.now());
                router.refresh();
              }}
            />
          ) : (
            <Status
              post={post}
              projectId={project.id}
              instagram={ig}
              timeZone={timeZone}
              now={now}
              onChange={(p) => {
                setPost(p);
                // A cancelled post goes straight back to the form, with its words.
                if (p.status === "cancelled") setComposing(true);
                setNow(Date.now());
                router.refresh();
              }}
              onCompose={() => setComposing(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ post, title }: { post: Post | null; title: string }) {
  const s = post?.status;
  const eyebrow =
    s === "posted" ? "Posted" : s === "scheduled" ? "Scheduled" : s === "publishing" ? "Posting" : s === "failed" || s === "held" ? "Needs attention" : "Ready to post";
  const heading =
    s === "posted" ? "Posted." : s === "scheduled" ? "Scheduled" : s === "publishing" ? "Posting to Instagram" : s === "failed" || s === "held" ? "Not posted yet" : "Post to Instagram";
  return (
    <header className="flex flex-col gap-3 border-b border-hairline pb-6">
      <span className="eyebrow flex items-center gap-2">
        {s === "publishing" && <span className="size-2 rounded-full bg-render-orange" aria-hidden />}
        Step 4 · Post · {eyebrow}
      </span>
      <h1 className="break-words font-display text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">{heading}</h1>
      <p className="max-w-2xl truncate text-taupe sm:whitespace-normal">{title}</p>
    </header>
  );
}

function ConnectBanner({ result }: { result: Exclude<ConnectResult, null> }) {
  if (result.ok) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-xl border border-hairline bg-surface p-4 text-sm">
        <Check className="size-4 text-sand-gold" aria-hidden /> Instagram is connected. You can post now.
      </p>
    );
  }
  const t = CONNECT_ERROR_TEXT[result.reason];
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-xl border border-sand-gold bg-sand-gold/15 p-4 text-sm">
      <span className="font-medium">{t.title}</span>
      <span className="text-espresso/80">{t.text}</span>
    </div>
  );
}

/** Where the post goes: the linked account, or a button to link one. */
function Target({ instagram, projectId }: { instagram: InstagramStatus; projectId: string }) {
  if (!instagram.connected) {
    return (
      <section aria-labelledby="target-h" className="flex flex-col gap-3 rounded-xl border border-sand-gold bg-sand-gold/15 p-5">
        <h2 id="target-h" className="font-mono text-xs font-semibold uppercase tracking-wider">
          Instagram account
        </h2>
        {instagram.available ? (
          <>
            <p className="text-sm">Connect your Instagram professional account to post this video.</p>
            <a href={connectHref(projectId)} className={buttonClasses("primary", "md", "w-fit")}>
              <AtSign className="size-4" aria-hidden /> Connect Instagram
            </a>
          </>
        ) : (
          <p className="text-sm">Posting to Instagram isn’t set up on this site yet. You can still download the MP4 in step 3.</p>
        )}
      </section>
    );
  }
  const reconnect = instagram.status === "reconnect_needed";
  return (
    <section
      aria-labelledby="target-h"
      className={cn("flex flex-col gap-3 rounded-xl border p-5", reconnect ? "border-sand-gold bg-sand-gold/15" : "border-hairline bg-surface")}
    >
      <h2 id="target-h" className="font-mono text-xs font-semibold uppercase tracking-wider">
        Posting to
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        {instagram.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Instagram's own picture URL
          <img src={instagram.avatarUrl} alt="" className="size-10 rounded-full border border-hairline object-cover" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-warm" aria-hidden>
            <AtSign className="size-5 text-taupe" />
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">@{instagram.username}</span>
          <span className="text-sm text-taupe">{reconnect ? "Needs reconnecting before it can post" : "Instagram Reel"}</span>
        </span>
        {reconnect && (
          <a href={connectHref(projectId)} className={buttonClasses("primary", "sm", "ml-auto")}>
            <RotateCcw className="size-4" aria-hidden /> Reconnect
          </a>
        )}
      </div>
    </section>
  );
}

function Compose({
  project,
  render,
  instagram,
  timeZone,
  outdated,
  previous,
  onPosted,
}: {
  project: Project;
  render: Render;
  instagram: InstagramStatus;
  timeZone: string;
  outdated: boolean;
  previous: Post | null;
  onPosted: (p: Post) => void;
}) {
  const [caption, setCaption] = useState(previous?.caption ?? "");
  const [tags, setTags] = useState(() => (previous?.hashtags ?? []).map((h) => `#${h}`).join(" "));
  const [loaded, setLoaded] = useState(false);
  const [writing, setWriting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const [slot, setSlot] = useState(() => defaultSlot(timeZone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErr | null>(null);
  const [askRepost, setAskRepost] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const pid = project.id;

  const suggest = useCallback(async () => {
    setWriting(true);
    setAiError(null);
    try {
      const s = await call<{ caption: string; hashtags: string[] }>(`/api/projects/${pid}/caption`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      setCaption(s.caption);
      setTags(s.hashtags.map((h) => `#${h}`).join(" "));
    } catch (e) {
      setAiError((e as ApiErr).message);
    } finally {
      setWriting(false);
    }
  }, [pid]);

  // Start from the saved draft, else the last post's words, else an AI suggestion.
  // Browser storage only exists after mount, so this runs in an effect.
  useEffect(() => {
    const d = readDraft(pid);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time load from localStorage after mount */
    if (d && (d.caption || d.hashtags)) {
      setCaption(d.caption);
      setTags(d.hashtags);
    } else if (previous && (previous.caption || previous.hashtags.length)) {
      setCaption(previous.caption);
      setTags(previous.hashtags.map((h) => `#${h}`).join(" "));
    } else {
      void suggest();
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  useEffect(() => {
    if (loaded) writeDraft(pid, caption || tags ? { caption, hashtags: tags } : null);
    key.current = null; // new words, new request
  }, [loaded, pid, caption, tags]);
  // A clock for the "at least 10 minutes ahead" check.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  /** A new time is a new request. */
  function changeWhen(next: { mode?: "now" | "scheduled"; slot?: { date: string; time: string } }) {
    if (next.mode) setMode(next.mode);
    if (next.slot) setSlot(next.slot);
    key.current = null;
    setError(null);
    setAskRepost(null);
  }

  const hashtags = parseHashtags(tags);
  const text = fullCaption(caption, hashtags);
  const length = text.length;
  const tagCount = countHashtags(text);
  const tooLong = length > CAPTION_MAX;
  const tooManyTags = tagCount > HASHTAGS_MAX;
  const canPublish = instagram.connected && instagram.status === "connected";

  let when: Date | null = null;
  let slotError: string | null = null;
  if (mode === "scheduled") {
    if (!slot.date || !slot.time) slotError = "Pick a date and a time.";
    else {
      when = zonedToUtc(slot.date, slot.time, timeZone);
      if (when.getTime() < clock + SCHEDULE_MIN_MS) slotError = "Pick a time at least 10 minutes from now.";
    }
  }

  async function submit(confirmRepost = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    key.current ??= newKey();
    try {
      const { post } = await call<{ post: Post }>(`/api/projects/${pid}/posts`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key.current },
        body: JSON.stringify({
          renderId: render.id,
          caption,
          hashtags,
          mode,
          ...(mode === "scheduled" && when ? { scheduledAt: when.toISOString() } : {}),
          timeZone,
          ...(confirmRepost ? { confirmRepost: true } : {}),
        }),
      });
      writeDraft(pid, null);
      key.current = null;
      onPosted(post);
    } catch (e) {
      const err = e as ApiErr;
      if (err.code !== "OFFLINE") key.current = null; // offline: the same key, so a resend can't post twice
      if (err.code === "SCHEDULE_OUT_OF_RANGE" && typeof err.details?.nearestValid === "string") {
        setSlot(utcToZoned(new Date(err.details.nearestValid), timeZone));
        setError({ ...err, message: `${err.message} We moved it to the nearest time that works. Check it and press Schedule again.` });
      } else if (err.code === "ALREADY_POSTED" && err.details?.status === "posted") {
        setAskRepost(err.message);
      } else if (err.code === "ALREADY_POSTED") {
        // Another tab posted or scheduled it: show that post.
        try {
          const { post } = await call<{ post: Post | null }>(`/api/projects/${pid}/posts`);
          if (post) return onPosted(post);
        } catch {
          /* show the error */
        }
        setError(err);
      } else {
        setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  const zone = zoneLabel(timeZone);
  const ready = canPublish && !tooLong && !tooManyTags && !slotError && !writing;

  return (
    <>
      {outdated && (
        <p role="status" className="rounded-xl border border-sand-gold bg-sand-gold/15 p-4 text-sm">
          You’ve changed the storyboard since this video was made. This posts the video as it is now (version {render.version}). To post the
          changes, make the video again from the storyboard first.
        </p>
      )}

      <Target instagram={instagram} projectId={pid} />

      <section aria-labelledby="caption-h" className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="caption-h" className="font-mono text-xs font-semibold uppercase tracking-wider">
            Caption
          </h2>
          <Button variant="secondary" size="sm" onClick={suggest} disabled={writing} aria-busy={writing}>
            {writing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            {caption ? "Rewrite with AI" : "Write with AI"}
          </Button>
        </div>
        <label className="sr-only" htmlFor="caption">
          Caption
        </label>
        <textarea
          id="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={6}
          placeholder={writing ? "Writing a caption…" : "What should people know about this video?"}
          aria-invalid={tooLong || undefined}
          aria-describedby="caption-count"
          className="w-full resize-y rounded-lg border border-hairline bg-surface px-4 py-3 text-[15px] leading-relaxed text-espresso placeholder:text-taupe/70 focus:border-sand-gold focus:outline-none focus:ring-2 focus:ring-sand-gold/40 aria-[invalid=true]:border-danger/60"
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="hashtags" className="text-sm font-medium">
            Hashtags
          </label>
          <input
            id="hashtags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="#science #explained"
            aria-invalid={tooManyTags || undefined}
            aria-describedby="caption-count"
            className="h-12 w-full rounded-lg border border-hairline bg-surface px-4 text-[15px] text-espresso placeholder:text-taupe/70 focus:border-sand-gold focus:outline-none focus:ring-2 focus:ring-sand-gold/40 aria-[invalid=true]:border-danger/60"
          />
        </div>
        <p id="caption-count" className="flex flex-wrap justify-between gap-2 font-mono text-xs uppercase tracking-wider text-taupe" aria-live="polite">
          <span className={cn(tooLong && "font-semibold text-danger")}>
            {length.toLocaleString("en-GB")} / {CAPTION_MAX.toLocaleString("en-GB")} characters
          </span>
          <span className={cn(tooManyTags && "font-semibold text-danger")}>
            {tagCount} / {HASHTAGS_MAX} hashtags
          </span>
        </p>
        {tooLong && <p className="text-sm text-danger">Instagram allows {CAPTION_MAX.toLocaleString("en-GB")} characters, hashtags included. Shorten it a little.</p>}
        {tooManyTags && <p className="text-sm text-danger">Instagram allows {HASHTAGS_MAX} hashtags. Remove a few.</p>}
        {aiError && (
          <p role="alert" className="text-sm text-danger">
            {aiError}
          </p>
        )}
      </section>

      <section aria-labelledby="cover-h" className="flex items-center gap-4 rounded-xl border border-hairline bg-surface p-5">
        {render.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- private, signed image
          <img src={render.thumbnailUrl} alt="" className="aspect-[9/16] w-14 shrink-0 rounded-md border border-hairline object-cover" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="cover-h" className="font-mono text-xs font-semibold uppercase tracking-wider">
            Cover
          </h2>
          <p className="text-sm text-taupe">The Reel uses the cover you chose in step 3.</p>
          <Link href={`/videos/${pid}/video`} className="tap w-fit text-sm font-medium underline-offset-4 hover:underline">
            Change cover
          </Link>
        </div>
      </section>

      <section aria-labelledby="when-h" className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-5 sm:p-6">
        <h2 id="when-h" className="font-mono text-xs font-semibold uppercase tracking-wider">
          When
        </h2>
        <div
          role="radiogroup"
          aria-labelledby="when-h"
          className="grid grid-cols-2 gap-2 rounded-lg bg-surface-warm p-1 sm:max-w-sm"
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
            e.preventDefault();
            const next = mode === "now" ? "scheduled" : "now";
            changeWhen({ mode: next });
            (e.currentTarget.children[next === "now" ? 0 : 1] as HTMLElement | undefined)?.focus();
          }}
        >
          {(["now", "scheduled"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              tabIndex={mode === m ? 0 : -1}
              onClick={() => changeWhen({ mode: m })}
              className={cn(
                "h-11 rounded-md text-sm font-medium transition-colors sm:h-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-gold",
                mode === m ? "bg-surface shadow-sm" : "text-taupe hover:text-espresso",
              )}
            >
              {m === "now" ? "Post now" : "Schedule"}
            </button>
          ))}
        </div>
        {mode === "scheduled" && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Date
                <input
                  type="date"
                  value={slot.date}
                  min={utcToZoned(new Date(clock), timeZone).date}
                  onChange={(e) => changeWhen({ slot: { ...slot, date: e.target.value } })}
                  className="h-12 rounded-lg border border-hairline bg-surface px-3 text-[15px] font-normal focus:border-sand-gold focus:outline-none focus:ring-2 focus:ring-sand-gold/40"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Time
                <input
                  type="time"
                  value={slot.time}
                  onChange={(e) => changeWhen({ slot: { ...slot, time: e.target.value } })}
                  className="h-12 rounded-lg border border-hairline bg-surface px-3 text-[15px] font-normal focus:border-sand-gold focus:outline-none focus:ring-2 focus:ring-sand-gold/40"
                />
              </label>
            </div>
            <p className="text-sm text-taupe">
              Your time zone: {timeZone.replace(/_/g, " ")} ({zone}).{" "}
              <Link href="/settings" className="tap underline-offset-4 hover:underline">
                Change
              </Link>
            </p>
            {slotError ? (
              <p className="text-sm text-danger">{slotError}</p>
            ) : (
              when && <p className="text-sm">Goes out {formatInZone(when, timeZone)}.</p>
            )}
          </div>
        )}
      </section>

      {askRepost && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-sand-gold bg-sand-gold/15 p-5 text-sm">
          <span>{askRepost}</span>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => submit(true)} disabled={busy} aria-busy={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} {mode === "now" ? "Post it again" : "Schedule it again"}
            </Button>
            <Button variant="secondary" onClick={() => setAskRepost(null)} disabled={busy}>
              Not now
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-sand-gold bg-sand-gold/15 p-4 text-sm">
          <span>{error.message}</span>
          {(error.code === "INSTAGRAM_NOT_CONNECTED" || error.code === "INSTAGRAM_RECONNECT_NEEDED") && (
            <a href={connectHref(pid)} className="w-fit font-medium underline underline-offset-4">
              {error.code === "INSTAGRAM_NOT_CONNECTED" ? "Connect Instagram" : "Reconnect Instagram"}
            </a>
          )}
          {error.code === "RENDER_NOT_LATEST" && (
            <Link href={`/videos/${pid}/video`} className="w-fit font-medium underline underline-offset-4">
              Open the newest video
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button size="lg" onClick={() => submit()} disabled={!ready || busy || !!askRepost} aria-busy={busy} className="w-full sm:w-auto">
          {busy ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : mode === "now" ? (
            <Send className="size-5" aria-hidden />
          ) : (
            <CalendarClock className="size-5" aria-hidden />
          )}
          {mode === "now" ? "Post now" : "Schedule post"}
        </Button>
        {!canPublish && <p className="text-sm text-taupe">Connect Instagram above to post.</p>}
      </div>
    </>
  );
}

function Status({
  post,
  projectId,
  instagram,
  timeZone,
  now,
  onChange,
  onCompose,
}: {
  post: Post;
  projectId: string;
  instagram: InstagramStatus;
  timeZone: string;
  now: number;
  onChange: (p: Post) => void;
  onCompose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const zone = post.timeZone ?? timeZone;
  const account = post.igUsername ? `@${post.igUsername}` : "your Instagram";

  async function act(name: string, url: string, body?: unknown) {
    setBusy(name);
    setError(null);
    try {
      const { post: next } = await call<{ post: Post }>(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      onChange(next);
    } catch (e) {
      setError((e as ApiErr).message);
    } finally {
      setBusy(null);
    }
  }

  const excerpt = (
    <section aria-label="Post" className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-5 sm:p-6">
      <dl className="flex flex-col">
        <Row k="Account" v={account} />
        <Row
          k={post.status === "posted" ? "Posted" : "Time"}
          v={formatInZone(new Date(post.postedAt ?? post.scheduledAt), zone) + ` (${zoneLabel(zone, new Date(post.postedAt ?? post.scheduledAt))})`}
        />
      </dl>
      {(post.caption || post.hashtags.length > 0) && (
        <p className="line-clamp-4 whitespace-pre-line border-t border-hairline pt-3 text-sm text-taupe">{fullCaption(post.caption, post.hashtags)}</p>
      )}
    </section>
  );
  const errorLine = error && (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  );

  if (post.status === "publishing" || (post.status === "scheduled" && new Date(post.scheduledAt).getTime() <= now)) {
    return (
      <>
        <section role="status" className="flex items-start gap-3 rounded-xl border border-sand-gold bg-sand-gold/10 p-5">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-render-orange" aria-hidden />
          <span className="flex flex-col gap-1">
            <span className="font-medium">Sending your Reel to {account}</span>
            <span className="text-sm text-taupe">Instagram processes the video first. This usually takes under a minute. You can leave this page.</span>
          </span>
        </section>
        {excerpt}
      </>
    );
  }

  if (post.status === "posted") {
    return (
      <>
        <p className="text-lg">Your video is live on {account}.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className={buttonClasses("primary", "lg", "w-full sm:w-auto")}>
              View on Instagram <ExternalLink className="size-5" aria-hidden />
            </a>
          )}
          <Link href="/new" className={buttonClasses("secondary", "lg", "w-full sm:w-auto")}>
            Make another video <ArrowRight className="size-5" aria-hidden />
          </Link>
        </div>
        {excerpt}
        <button type="button" onClick={onCompose} className="w-fit text-sm font-medium text-taupe underline-offset-4 hover:text-espresso hover:underline">
          Post this video again
        </button>
      </>
    );
  }

  if (post.status === "scheduled") {
    const locked = post.editableUntil ? new Date(post.editableUntil).getTime() <= now : true;
    return (
      <>
        <section className="flex items-start gap-3 rounded-xl border border-hairline bg-surface p-5">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-sand-gold" aria-hidden />
          <span className="flex flex-col gap-1">
            <span className="font-medium">
              Goes out {formatInZone(new Date(post.scheduledAt), zone)} ({zoneLabel(zone, new Date(post.scheduledAt))})
            </span>
            <span className="text-sm text-taupe">ClipGuru posts it to {account} at that time. You don’t need to keep this page open.</span>
          </span>
        </section>
        {excerpt}
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            className="w-fit"
            onClick={() => act("cancel", `/api/posts/${post.id}/cancel`)}
            disabled={locked || !!busy}
            aria-busy={busy === "cancel"}
          >
            {busy === "cancel" && <Loader2 className="size-4 animate-spin" aria-hidden />} Cancel scheduled post
          </Button>
          <p className="text-sm text-taupe">
            {locked ? "It’s too close to the posting time to cancel." : `You can cancel until ${LOCK_BEFORE_MS / 60_000} minutes before.`}
          </p>
          {errorLine}
        </div>
      </>
    );
  }

  // failed or held
  const held = post.status === "held";
  const igReady = instagram.connected && instagram.status === "connected";
  const needsAccount = held || post.error?.code === "IG_RECONNECT";
  return (
    <>
      <section role="alert" className="flex flex-col gap-3 rounded-xl border border-sand-gold bg-sand-gold/15 p-5 sm:p-6">
        <span className="flex items-center gap-2 font-medium">
          <AlertTriangle className="size-4" aria-hidden />
          {held ? "On hold: Instagram needs reconnecting" : "Instagram didn’t take this post"}
        </span>
        <span className="text-sm text-espresso/80">{post.error?.message ?? "The post didn’t go out."}</span>
        {needsAccount && !igReady && (
          <a href={connectHref(projectId)} className={buttonClasses("primary", "md", "w-fit")}>
            <AtSign className="size-4" aria-hidden /> {instagram.connected ? "Reconnect Instagram" : "Connect Instagram"}
          </a>
        )}
      </section>
      {excerpt}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          size="lg"
          onClick={() => act("retry", `/api/posts/${post.id}/retry`, { mode: "now", timeZone })}
          disabled={!igReady || !!busy}
          aria-busy={busy === "retry"}
          className="w-full sm:w-auto"
        >
          {busy === "retry" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <RotateCcw className="size-5" aria-hidden />} Post now
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={!!busy}
          onClick={async () => {
            if (held) {
              // A held post blocks a new one only while it's held; cancel it, then write a fresh one.
              setBusy("edit");
              setError(null);
              try {
                await call(`/api/posts/${post.id}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
              } catch (e) {
                setError((e as ApiErr).message);
                setBusy(null);
                return;
              }
              setBusy(null);
            }
            onCompose();
          }}
        >
          Edit caption or time
        </Button>
      </div>
      {errorLine}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0">
      <dt className="text-taupe">{k}</dt>
      <dd className="min-w-0 text-right font-medium">{v}</dd>
    </div>
  );
}
