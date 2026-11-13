/** ElevenLabs voice ids (API Design → GET /api/voices). */
export const VOICE_GEORGE = "JBFqnCBsd6RMkjVDRZzb";
export const VOICE_ALICE = "Xb7hH8MSUJpSbSDYk0k2";
export const DEFAULT_VOICE_ID = VOICE_GEORGE;

export const DEFAULT_TIME_ZONE = "Europe/London";

/** True for a valid IANA time zone such as "Europe/Berlin". */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
