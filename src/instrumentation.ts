import type { Instrumentation } from "next";

/**
 * Error tracking for V1: every server error (pages, API routes, server actions) is logged as one
 * JSON line with its route and digest. Vercel keeps these under Logs and Observability → Errors,
 * and the digest matches the code shown on the error page, so a report from a teammate can be
 * found. A hosted tracker (e.g. Sentry) can plug in here later.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_error",
      message: e.message,
      digest: e.digest ?? null,
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      routeType: context.routeType,
      stack: e.stack?.split("\n").slice(0, 8).join("\n"),
    }),
  );
};
