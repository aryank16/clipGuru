import "server-only";
import { NextResponse } from "next/server";
import { attachment, storage } from "../storage";
import { ApiError } from "./errors";

/**
 * Sends a stored file to the browser: a redirect to a short-lived R2 link, or the bytes from the
 * memory store locally. `downloadAs` makes the browser save it under that name. route() marks the
 * response no-store, which matters here: the same address can point at a different file later (a new cover).
 */
export async function serveFile(key: string, opts: { downloadAs?: string } = {}): Promise<NextResponse> {
  const files = storage();
  const headers: Record<string, string> = {};
  if (files.read) {
    const f = await files.read(key);
    if (!f) throw new ApiError("NOT_FOUND");
    if (opts.downloadAs) headers["content-disposition"] = attachment(opts.downloadAs);
    return new NextResponse(f.body as BodyInit, {
      headers: { ...headers, "content-type": f.contentType, "content-length": String(f.body.byteLength) },
    });
  }
  return NextResponse.redirect(await files.signedUrl(key, 3600, opts.downloadAs), 302);
}

/** A file name for a download: the title made safe for any file system, never empty. */
export function fileNameFor(title: string, ext: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `${base || "clipguru-video"}.${ext}`;
}
