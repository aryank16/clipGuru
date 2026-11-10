import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { ApiError } from "./errors";

/**
 * Wraps a route handler with the API conventions from the API Design:
 * - every response gets `X-Request-Id` and `Cache-Control: no-store`
 * - thrown `ApiError`s become `{ error: { code, message, details } }`
 * - anything else becomes `500 INTERNAL` (logged with the request id)
 * - writes (POST/PUT/PATCH/DELETE) must come from the app's own origin
 */
export function route<Ctx>(handler: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const requestId = crypto.randomUUID();
    let res: Response;
    try {
      checkOrigin(req);
      res = await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        res = NextResponse.json(err.toBody(), { status: err.status });
      } else {
        console.error(`[api] ${req.method} ${new URL(req.url).pathname} ${requestId}`, err);
        res = NextResponse.json(new ApiError("INTERNAL").toBody(), { status: 500 });
      }
    }
    res.headers.set("X-Request-Id", requestId);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Same-origin check for writes. Requests without an Origin header (server-to-server) pass. */
export function checkOrigin(req: Request): void {
  if (!WRITE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const allowed = new Set([new URL(req.url).origin]);
  if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).origin);
  if (!allowed.has(origin)) throw new ApiError("FORBIDDEN_ORIGIN");
}

/** JSON response with the given status (default 200). */
export function json<T>(data: T, status = 200): Response {
  return NextResponse.json(data, { status });
}

/** Turn a Zod error into `details: { "field.path": "message" }`. */
function zodDetails(error: z.ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    details[issue.path.join(".") || "_"] = issue.message;
  }
  return details;
}

/** Parse and validate a JSON body; throws `400 VALIDATION_FAILED` with per-field details. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Body must be valid JSON.", { _: "invalid_json" });
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError("VALIDATION_FAILED", undefined, zodDetails(result.error));
  return result.data;
}

/** Validate the query string against a schema. */
export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) throw new ApiError("VALIDATION_FAILED", undefined, zodDetails(result.error));
  return result.data;
}
