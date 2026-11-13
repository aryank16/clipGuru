import { ApiError } from "../api/errors";
import { decodeCursor, encodeCursor } from "../api/pagination";
import { FILTER_STATUSES, PROJECT_FILTERS, type FilterCounts, type ProjectRecord } from "./types";

export type Cursor = { u: string; i: string };

export function cursorFor(r: ProjectRecord): string {
  return encodeCursor({ u: r.updatedAt.toISOString(), i: r.id });
}

export function readCursor(cursor: string | undefined): Cursor | null {
  if (!cursor) return null;
  const c = decodeCursor<Cursor>(cursor);
  if (typeof c.u !== "string" || typeof c.i !== "string" || Number.isNaN(Date.parse(c.u))) {
    throw new ApiError("VALIDATION_FAILED", "Invalid cursor.", { cursor: "invalid" });
  }
  return c;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countsFrom(rows: [string, number][]): FilterCounts {
  const byStatus = new Map(rows);
  const counts = {} as FilterCounts;
  for (const f of PROJECT_FILTERS) {
    const statuses = FILTER_STATUSES[f];
    counts[f] = statuses
      ? statuses.reduce((n, s) => n + (byStatus.get(s) ?? 0), 0)
      : rows.reduce((n, [, c]) => n + c, 0);
  }
  return counts;
}

