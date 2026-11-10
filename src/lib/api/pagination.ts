import { ApiError } from "./errors";

/** Opaque base64url cursor holding the last item's sort values (API Design: Cursor pagination). */
export function encodeCursor(values: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

export function decodeCursor<T extends Record<string, unknown>>(cursor: string): T {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad");
    return parsed as T;
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Invalid cursor.", { cursor: "invalid" });
  }
}

export type Page<T> = { items: T[]; nextCursor: string | null };
