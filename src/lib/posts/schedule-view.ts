import type { Post } from "./types";
import { utcToZoned } from "../zoned";

/** How far back the Scheduled page shows posted and failed posts. */
export const RECENT_DAYS = 30;
const DAY = 24 * 3600_000;

export type ScheduleGroups = {
  /** Failed or held: the person needs to act. Newest first. */
  attention: Post[];
  /** Scheduled or being sent. Soonest first. */
  upcoming: Post[];
  /** Posted in the last RECENT_DAYS days. Newest first. */
  recent: Post[];
};

const when = (p: Post) => new Date(p.postedAt ?? p.scheduledAt).getTime();

/** Splits a person's posts into the Scheduled page's three lists. Cancelled posts are left out. */
export function groupPosts(posts: Post[], now: Date): ScheduleGroups {
  const since = now.getTime() - RECENT_DAYS * DAY;
  const attention = posts.filter((p) => (p.status === "failed" || p.status === "held") && when(p) >= since);
  const upcoming = posts.filter((p) => p.status === "scheduled" || p.status === "publishing");
  const recent = posts.filter((p) => p.status === "posted" && when(p) >= since);
  return {
    attention: attention.sort((a, b) => when(b) - when(a)),
    upcoming: upcoming.sort((a, b) => when(a) - when(b)),
    recent: recent.sort((a, b) => when(b) - when(a)),
  };
}

export type WeekDay = { date: string; weekday: string; day: number; isToday: boolean; scheduled: number; posted: number };

/** "2026-11-20" + n days, as a date string (calendar arithmetic, no time zone involved). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday on or before a date string. */
export function mondayOf(date: string): string {
  const dow = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
  return addDays(date, -dow);
}

/** Seven days from a Monday, each with how many posts are scheduled or went out that day in the zone. */
export function weekDays(monday: string, posts: Post[], timeZone: string, now: Date): WeekDay[] {
  const today = utcToZoned(now, timeZone).date;
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names.map((weekday, i) => {
    const date = addDays(monday, i);
    const on = posts.filter((p) => utcToZoned(new Date(p.postedAt ?? p.scheduledAt), timeZone).date === date);
    return {
      date,
      weekday,
      day: Number(date.slice(8, 10)),
      isToday: date === today,
      scheduled: on.filter((p) => p.status === "scheduled" || p.status === "publishing").length,
      posted: on.filter((p) => p.status === "posted").length,
    };
  });
}
