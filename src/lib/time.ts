const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "just now", "5m ago", "2h ago", "yesterday", "3 days ago", then "4 Nov" (or "4 Nov 2025" in another year). */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  const diff = now.getTime() - t.getTime();
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 2 * DAY) return "yesterday";
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} days ago`;
  return t.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(t.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** 74 → "01:14". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
