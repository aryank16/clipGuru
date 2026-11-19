import { z } from "zod";
import { json, parseQuery, route } from "@/lib/api/route";
import { postSvc } from "@/lib/posts";
import { POST_STATUSES, type PostStatus } from "@/lib/posts/types";
import { requireApiSession } from "@/lib/session";

const DAY = 24 * 3600_000;

const query = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()) : undefined))
    .refine((v) => !v || v.every((s) => (POST_STATUSES as readonly string[]).includes(s)), "unknown_status"),
});

/** GET /api/posts — posts by time (default: this month), for the Scheduled page. */
export const GET = route(async (req) => {
  const { user } = await requireApiSession(req);
  const q = parseQuery(req, query);
  const now = new Date();
  const from = q.from ? new Date(q.from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = q.to ? new Date(q.to) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  // At most a year at a time.
  const end = new Date(Math.min(to.getTime(), from.getTime() + 366 * DAY));
  return json({ items: await postSvc().list(user.id, { from, to: end, statuses: q.status as PostStatus[] | undefined }) });
});
