import { json, route } from "@/lib/api/route";

/** Liveness check: `GET /api/health` → `{ ok: true }`. */
export const GET = route(async () => json({ ok: true, service: "clipguru", time: new Date().toISOString() }));
