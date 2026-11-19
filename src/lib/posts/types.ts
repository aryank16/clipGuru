/** Posts (Database Design → posts; API Design → Posts). One ready render sent to the person's Instagram. */

export const POST_STATUSES = ["scheduled", "publishing", "posted", "failed", "held", "cancelled"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
/** Waiting for its time or being sent: at most one per video. */
export const ACTIVE_POST_STATUSES: PostStatus[] = ["scheduled", "publishing"];

export const CAPTION_MAX = 2200;
export const HASHTAGS_MAX = 30;
/** How far ahead a post can be scheduled. */
export const SCHEDULE_MIN_MS = 10 * 60_000;
export const SCHEDULE_MAX_MS = 60 * 24 * 3600_000;
/** A scheduled post can't be changed or cancelled this close to its time. */
export const LOCK_BEFORE_MS = 5 * 60_000;

/** Errors from the publishing job (API Design → Error codes, last paragraph). */
export type PostErrorCode = "IG_REJECTED" | "IG_UNAVAILABLE" | "IG_DAILY_LIMIT" | "IG_RECONNECT";
export type PostError = { code: PostErrorCode; message: string };

export type PostRecord = {
  id: string;
  userId: string;
  projectId: string;
  renderId: string;
  caption: string;
  /** Without "#". */
  hashtags: string[];
  coverOffsetMs: number;
  mode: "now" | "scheduled";
  /** When it goes out (now for mode "now"). */
  scheduledAt: Date;
  timeZone: string | null;
  status: PostStatus;
  /** The Instagram account it was sent to (username at the time). */
  igUserId: string | null;
  igUsername: string | null;
  /** Meta's media container while it processes the video, then the published media id. */
  containerId: string | null;
  mediaId: string | null;
  permalink: string | null;
  error: PostError | null;
  /**
   * Changes each time the post is (re)started. The background run carries the token it was started
   * with and stops when it no longer matches, so an old sleeping run never posts a rescheduled post.
   */
  runToken: string;
  idempotencyKey: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  postedAt: Date | null;
};

/** What the browser gets. */
export type Post = {
  id: string;
  projectId: string;
  renderId: string;
  thumbnailUrl: string;
  caption: string;
  hashtags: string[];
  coverOffsetMs: number;
  mode: "now" | "scheduled";
  scheduledAt: string;
  timeZone: string | null;
  status: PostStatus;
  igUsername: string | null;
  permalink: string | null;
  error: PostError | null;
  editableUntil: string | null;
  postedAt: string | null;
  createdAt: string;
};

export function toPost(r: PostRecord): Post {
  return {
    id: r.id,
    projectId: r.projectId,
    renderId: r.renderId,
    thumbnailUrl: `/api/renders/${r.renderId}/thumbnail`,
    caption: r.caption,
    hashtags: r.hashtags,
    coverOffsetMs: r.coverOffsetMs,
    mode: r.mode,
    scheduledAt: r.scheduledAt.toISOString(),
    timeZone: r.timeZone,
    status: r.status,
    igUsername: r.igUsername,
    permalink: r.permalink,
    error: r.error,
    editableUntil: r.status === "scheduled" ? new Date(r.scheduledAt.getTime() - LOCK_BEFORE_MS).toISOString() : null,
    postedAt: r.postedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

/** "water cycle", "#Science!" → "watercycle", "Science". Letters, digits and underscores only. */
export function cleanHashtag(tag: string): string {
  return tag.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 100);
}

/** Splits "#a #b, c" into ["a", "b", "c"], dropping blanks and repeats (case-insensitive). */
export function parseHashtags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    const t = cleanHashtag(raw);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

/** Instagram counts every hashtag in the text, including ones typed into the caption itself. */
export function countHashtags(text: string): number {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}

/** The text Instagram gets: the caption, a blank line, then the hashtags. */
export function fullCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags.map((h) => `#${h}`).join(" ");
  const c = caption.trim();
  return c && tags ? `${c}\n\n${tags}` : c || tags;
}
