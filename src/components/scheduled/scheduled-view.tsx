"use client";

import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { addDays, groupPosts, mondayOf, RECENT_DAYS, weekDays } from "@/lib/posts/schedule-view";
import { LOCK_BEFORE_MS, type Post, type PostStatus } from "@/lib/posts/types";
import { formatInZone, utcToZoned, zoneLabel } from "@/lib/zoned";

/** A post plus its video's title (null when the video was deleted). */
export type ScheduledItem = Post & { title: string | null };

const STATUS: Record<PostStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  publishing: { label: "Posting", tone: "progress" },
  posted: { label: "Posted", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  held: { label: "On hold", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

/** Why a post needs attention, in plain words. */
function attentionText(p: ScheduledItem): string {
  if (p.status === "held" && !p.title) return "This video was deleted, so it can't be posted. Remove it from this list.";
  if (p.status === "held" || p.error?.code === "IG_RECONNECT") return "Instagram is disconnected. Reconnect it, then post again.";
  if (p.error?.code === "IG_DAILY_LIMIT") return "Instagram's daily posting limit was reached. Try again later.";
  if (p.error?.code === "IG_UNAVAILABLE") return "Instagram was unavailable. Try again.";
  return p.error?.message || "Instagram didn't accept this post.";
}

export function ScheduledView({ items, timeZone }: { items: ScheduledItem[]; timeZone: string }) {
  const router = useRouter();
  // The page is rendered on the server; "now" ticks so cancel locks and "today" stay right.
  const [now, setNow] = useState(() => new Date());
  // While something is due or being sent, reload the list now and then so it moves to Posted by itself.
  const busy = items.some((i) => i.status === "publishing" || (i.status === "scheduled" && new Date(i.scheduledAt) <= now));
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      if (busy) router.refresh();
    }, 30_000);
    return () => clearInterval(t);
  }, [busy, router]);
  const groups = useMemo(() => groupPosts(items, now), [items, now]);
  const [monday, setMonday] = useState(() => mondayOf(utcToZoned(now, timeZone).date));
  const days = weekDays(monday, items, timeZone, now);
  const thisMonday = mondayOf(utcToZoned(now, timeZone).date);
  const byId = new Map(items.map((i) => [i.id, i]));
  const empty = !groups.upcoming.length && !groups.recent.length && !groups.attention.length;

  if (empty) {
    return (
      <EmptyState
        icon={<CalendarClock className="size-5" />}
        title="Nothing scheduled"
        action={
          <Link href="/videos" className={buttonClasses("primary", "md")}>
            Go to My videos
          </Link>
        }
      >
        When you schedule a video for Instagram in step 4, it shows here with its posting time.
      </EmptyState>
    );
  }

  const first = new Date(`${days[0].date}T12:00:00Z`);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="week-title" className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="week-title" className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
            Week of {days[0].day} {monthLabel}
          </h2>
          <div className="flex items-center gap-1">
            <IconButton label="Previous week" icon={<ChevronLeft className="size-4" />} onClick={() => setMonday(addDays(monday, -7))} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMonday(thisMonday)}
              disabled={monday === thisMonday}
              className="h-11 font-mono text-xs uppercase tracking-[0.1em] disabled:text-muted/60 disabled:opacity-100 disabled:hover:bg-transparent sm:h-11"
            >
              Today
            </Button>
            <IconButton label="Next week" icon={<ChevronRight className="size-4" />} onClick={() => setMonday(addDays(monday, 7))} />
          </div>
        </div>
        <ol className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
          {days.map((d) => {
            const total = d.scheduled + d.posted;
            return (
              <li
                key={d.date}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2.5 sm:py-3",
                  d.isToday ? "bg-surface-sunken ring-1 ring-accent/50" : "",
                )}
              >
                <span className="sr-only">
                  {d.weekday} {d.day}: {total ? `${d.scheduled} scheduled, ${d.posted} posted` : "nothing"}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted sm:text-[11px]" aria-hidden>
                  {d.weekday}
                </span>
                <span className="font-mono text-base text-ink sm:text-lg" aria-hidden>{String(d.day).padStart(2, "0")}</span>
                <span className="flex h-2 items-center gap-1" aria-hidden>
                  {d.scheduled ? <span className="size-1.5 rounded-full bg-progress" /> : null}
                  {d.posted ? <span className="size-1.5 rounded-full bg-ink" /> : null}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-progress" aria-hidden /> Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-ink" aria-hidden /> Posted
          </span>
          <span suppressHydrationWarning>Times in {zoneLabel(timeZone, now)}</span>
        </p>
      </section>

      {groups.attention.length ? (
        <PostList title="Needs attention" count={groups.attention.length}>
          {groups.attention.map((p) => (
            <PostRow key={p.id} item={byId.get(p.id)!} timeZone={timeZone} now={now} onChange={() => router.refresh()} />
          ))}
        </PostList>
      ) : null}

      <PostList title="Upcoming" count={groups.upcoming.length}>
        {groups.upcoming.length ? (
          groups.upcoming.map((p) => (
            <PostRow key={p.id} item={byId.get(p.id)!} timeZone={timeZone} now={now} onChange={() => router.refresh()} />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-line px-5 py-6 text-sm text-muted">
            Nothing waiting to go out. Schedule a video from step 4 of any ready video.
          </p>
        )}
      </PostList>

      {groups.recent.length ? (
        <PostList title="Recently posted" count={groups.recent.length} note={`Last ${RECENT_DAYS} days`}>
          {groups.recent.map((p) => (
            <PostRow key={p.id} item={byId.get(p.id)!} timeZone={timeZone} now={now} onChange={() => router.refresh()} />
          ))}
        </PostList>
      ) : null}
    </div>
  );
}

function PostList({ title, count, note, children }: { title: string; count: number; note?: string; children: React.ReactNode }) {
  const id = `list-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink">
          {title} <span className="font-mono text-xs font-normal text-muted">[{String(count).padStart(2, "0")}]</span>
        </h2>
        {note ? <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{note}</span> : null}
      </div>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

function PostRow({ item, timeZone, now, onChange }: { item: ScheduledItem; timeZone: string; now: Date; onChange: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = STATUS[item.status];
  const at = new Date(item.postedAt ?? item.scheduledAt);
  const needsAttention = item.status === "failed" || item.status === "held";
  const held = item.status === "held";
  const locked = item.status === "scheduled" && new Date(item.scheduledAt).getTime() - now.getTime() < LOCK_BEFORE_MS;
  // A held post can always be dropped (the service allows held -> cancelled); a scheduled one until its lock.
  const canCancel = held || (item.status === "scheduled" && !locked);
  const videoHref = item.title ? `/videos/${item.projectId}/post` : null;
  // The badge already says Posted or Failed, so only the waiting states get a word before the time.
  const when =
    item.status === "scheduled" ? "Goes out " : held ? (new Date(item.scheduledAt) <= now ? "Was due " : "Set for ") : "";
  const verb = held ? "Remove" : "Cancel";
  // Keyboard users keep their place: focus moves into the confirm when it opens, and back to the trigger after "Keep it".
  const triggerRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (confirming ? keepRef : triggerRef).current?.focus();
  }, [confirming]);
  const openConfirm = () => {
    moveFocus.current = true;
    setConfirming(true);
  };
  const closeConfirm = () => {
    moveFocus.current = true;
    setConfirming(false);
  };

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${item.id}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? `Couldn't ${verb.toLowerCase()}. Try again.`);
      }
      onChange();
    } catch (e) {
      setError(e instanceof TypeError ? "Couldn't reach ClipGuru. Check your connection and try again." : (e as Error).message);
      setBusy(false);
      closeConfirm();
    }
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-surface p-3 sm:flex-row sm:items-center sm:p-4",
        needsAttention ? "border-progress/50 border-l-4" : "border-line",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="relative aspect-[9/16] w-14 shrink-0 overflow-hidden rounded-md bg-surface-sunken sm:w-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="font-mono text-xs text-muted" suppressHydrationWarning>
              {when}
              {formatInZone(at, timeZone, now)}
            </span>
          </p>
          <h3 className="text-[15px] leading-snug font-semibold break-words text-ink sm:text-base">
            {videoHref ? (
              <Link href={videoHref} className="tap hover:underline">
                {item.title}
              </Link>
            ) : (
              <span className="text-muted">Deleted video</span>
            )}
          </h3>
          {item.igUsername ? <p className="truncate font-mono text-xs text-muted">@{item.igUsername} · Instagram Reels</p> : null}
          {needsAttention ? (
            <p className="flex items-start gap-1.5 text-sm text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {attentionText(item)}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
        {item.status === "posted" && item.permalink ? (
          <a href={item.permalink} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm", "min-h-11 sm:min-h-0")}>
            Open on Instagram <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
        {needsAttention && videoHref ? (
          <Link href={videoHref} className={buttonClasses("primary", "sm", "min-h-11 sm:min-h-0")}>
            Fix and post
          </Link>
        ) : null}
        {item.status === "scheduled" && videoHref && !locked && !confirming ? (
          <Link href={videoHref} className={buttonClasses("secondary", "sm", "min-h-11 sm:min-h-0")}>
            <Pencil className="size-3.5" aria-hidden /> Edit
          </Link>
        ) : null}
        {canCancel && !confirming ? (
          <Button ref={triggerRef} type="button" variant="ghost" size="sm" className="min-h-11 sm:min-h-0" onClick={openConfirm}>
            {verb}
          </Button>
        ) : null}
        {confirming ? (
          <>
            <span className="text-sm text-ink">{verb} this post?</span>
            <Button type="button" variant="danger" size="sm" className="min-h-11 sm:min-h-0" onClick={cancel} disabled={busy} aria-busy={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Yes, {verb.toLowerCase()}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="min-h-11 sm:min-h-0" onClick={closeConfirm} disabled={busy} ref={keepRef}>
              Keep it
            </Button>
          </>
        ) : null}
        {locked ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Locked: going out soon</span>
        ) : null}
        {item.status === "publishing" ? (
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Posting now…
          </span>
        ) : null}
      </div>
    </li>
  );
}
