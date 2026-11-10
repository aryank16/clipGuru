# ClipGuru

Idea → AI explainer video → Instagram. V1 is for internal testing by the team.

Build progress, feature by feature, is tracked in the **ClipGuru Project Status** doc.

## Stack

Next.js (App Router) on Vercel · Better Auth · MongoDB · Inngest · Remotion on Vercel Sandbox ·
Cloudflare R2 · ElevenLabs · Gemini · Instagram API. Styling: Tailwind CSS v4 with the Atelier Light tokens.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys as features need them
npm run dev                  # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests (Vitest) |

## Layout

```
src/
  app/                 pages and REST route handlers (/api/*)
    api/health/        GET /api/health
  components/
    brand/             logo and monogram
    ui/                Atelier Light building blocks (button, input, card, badge)
  lib/
    api/               route() wrapper, error codes, validation, cursors (API Design conventions)
    env.ts             validated server environment
    cn.ts              class name helper
```

Every `/api` route is wrapped in `route()` from `src/lib/api/route.ts`, which adds `X-Request-Id` and
`Cache-Control: no-store`, checks the `Origin` on writes, and returns errors as
`{ "error": { "code", "message", "details" } }` with the codes listed in `src/lib/api/errors.ts`.
