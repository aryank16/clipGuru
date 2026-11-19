/** Dates in a person's time zone (scheduling posts). Works in the browser and on the server. */

/** Minutes the zone is ahead of UTC at the instant `utcMs`. */
function offsetMin(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/** "2026-11-20" + "18:30" in Europe/Berlin → the UTC instant. A time skipped by a clock change moves forward. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let t = wall - offsetMin(wall, timeZone) * 60_000;
  // Second pass for instants near a clock change.
  t = wall - offsetMin(t, timeZone) * 60_000;
  return new Date(t);
}

/** The UTC instant as { date: "2026-11-20", time: "18:30" } in the zone. */
export function utcToZoned(at: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${v("year")}-${v("month")}-${v("day")}`, time: `${v("hour")}:${v("minute")}` };
}

/** "Thu 20 Nov, 18:30" in the zone (with the year when it isn't this year). */
export function formatInZone(at: Date, timeZone: string, now = new Date()): string {
  const sameYear = utcToZoned(at, timeZone).date.slice(0, 4) === utcToZoned(now, timeZone).date.slice(0, 4);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(at);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // Built from parts: en-GB adds a comma after the weekday only when the year is shown.
  const day = `${v("weekday")} ${v("day")} ${v("month")}${sameYear ? "" : ` ${v("year")}`}`;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  return `${day}, ${time}`;
}

/** Where a time zone is now, e.g. "GMT+1". */
export function zoneLabel(timeZone: string, at = new Date()): string {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return name ?? timeZone;
}
