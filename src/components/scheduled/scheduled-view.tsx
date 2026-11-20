"use client";

import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
function attentionText(p: Post): string {
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
      <section aria-labelledby="week-title" className="rounded-xl border border-hairline bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="week-title" className="font-mono text-xs uppercase tracking-[0.12em] text-taupe">
            Week of {days[0].day} {monthLabel}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonday(addDays(monday, -7))}
              className="flex size-11 items-center justify-center rounded-lg text-espresso hover:bg-surface-warm/70"
              aria-label="Previous week"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonday(thisMonday)}
              disabled={monday === thisMonday}
              className="h-11 rounded-lg px-3 font-mono text-xs uppercase tracking-[0.1em] text-espresso hover:bg-surface-warm/70 disabled:text-taupe/60 disabled:hover:bg-transparent"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setMonday(addDays(monday, 7))}
              className="flex size-11 items-center justify-center rounded-lg text-espresso hover:bg-surface-warm/70"
              aria-label="Next week"
            >
              <ChevronRight className="size-4" />
            </button>
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
                  d.isToday ? "bg-surface-warm ring-1 ring-sand-gold/50" : "",
                )}
                aria-label={`${d.weekday} ${d.day}: ${total ? `${d.scheduled} scheduled, ${d.posted} posted` : "nothing"}`}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-taupe sm:text-[11px]">{d.weekday}</span>
                <span className="font-mono text-base text-espresso sm:text-lg">{String(d.day).padStart(2, "0")}</span>
                <span className="flex h-2 items-center gap-1" aria-hidden>
                  {d.scheduled ? <span className="size-1.5 rounded-full bg-render-orange" /> : null}
                  {d.posted ? <span className="size-1.5 rounded-full bg-espresso" /> : null}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-taupe">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-render-orange" aria-hidden /> Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-espresso" aria-hidden /> Posted
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
          <p className="rounded-xl border border-dashed border-hairline px-5 py-6 text-sm text-taupe">
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
        <h2 id={id} className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-espresso">
          {title} <span className="font-mono text-xs font-normal text-taupe">[{String(count).padStart(2, "0")}]</span>
        </h2>
        {note ? <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-taupe">{note}</span> : null}
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
  const canCancel = item.status === "scheduled" && new Date(item.scheduledAt).getTime() - now.getTime() >= LOCK_BEFORE_MS;
  const videoHref = item.title ? `/videos/${item.projectId}/post` : null;
  const when = item.status === "posted" ? "Posted" : item.status === "failed" ? "Failed" : item.status === "held" ? "Was due" : "Goes out";

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${item.id}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Couldn't cancel. Try again.");
      }
      onChange();
    } catch (e) {
      setError(e instanceof TypeError ? "Couldn't reach ClipGuru. Check your connection and try again." : (e as Error).message);
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-surface p-3 sm:flex-row sm:items-center sm:p-4",
        needsAttention ? "border-render-orange/50 border-l-4" : "border-hairline",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="relative aspect-[9/16] w-14 shrink-0 overflow-hidden rounded-md bg-surface-warm sm:w-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="font-mono text-xs text-taupe" suppressHydrationWarning>
              {when} {formatInZone(at, timeZone, now)}
            </span>
          </p>
          <h3 className="text-[15px] leading-snug font-semibold break-words text-espresso sm:text-base">
            {videoHref ? (
              <Link href={videoHref} className="hover:underline">
                {item.title}
              </Link>
            ) : (
              <span className="text-taupe">Deleted video</span>
            )}
          </h3>
          {item.igUsername ? <p className="truncate font-mono text-xs text-taupe">@{item.igUsername} · Instagram Reels</p> : null}
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
        {item.status === "scheduled" && videoHref && !confirming ? (
          <Link href={videoHref} className={buttonClasses("secondary", "sm", "min-h-11 sm:min-h-0")}>
            <Pencil className="size-3.5" aria-hidden /> Edit
          </Link>
        ) : null}
        {canCancel && !confirming ? (
          <Button type="button" variant="ghost" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setConfirming(true)}>
            Cancel
          </Button>
        ) : null}
        {confirming ? (
          <>
            <span className="text-sm text-espresso">Cancel this post?</span>
            <Button type="button" variant="danger" size="sm" className="min-h-11 sm:min-h-0" onClick={cancel} disabled={busy} aria-busy={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Yes, cancel
            </Button>
            <Button type="button" variant="ghost" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
          </>
        ) : null}
        {item.status === "scheduled" && !canCancel ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-taupe">Locked: going out soon</span>
        ) : null}
        {item.status === "publishing" ? (
          <span className="flex items-center gap-1.5 text-sm text-taupe">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Posting now…
          </span>
        ) : null}
      </div>
    </li>
  );
}
