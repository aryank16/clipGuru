/** "GMT+01:00" style offset for a zone right now ("GMT" for UTC itself). */
function offset(tz: string, at: Date): string {
  const part = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return (part ?? "GMT").replace("GMT", "UTC") || "UTC";
}

export type TimeZoneOption = { id: string; label: string };

/** Every IANA zone this runtime knows, labelled "Europe/Berlin (UTC+01:00)", with `current` always included. */
export function timeZoneOptions(current?: string, at: Date = new Date()): TimeZoneOption[] {
  const ids = new Set(Intl.supportedValuesOf("timeZone"));
  ids.add("UTC");
  if (current) ids.add(current);
  return [...ids].sort().map((id) => {
    const o = offset(id, at);
    return { id, label: `${id.replaceAll("_", " ")} (${o === "UTC" ? "UTC+00:00" : o})` };
  });
}
