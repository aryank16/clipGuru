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
    (auth)/            sign-in, sign-up, forgot-password, reset-password
    (app)/             signed-in pages (videos, ...)
    api/auth/[...all]/ Better Auth endpoints (/api/auth/*)
    api/health/        GET /api/health
  proxy.ts             sends signed-out visitors to /sign-in
  components/
    brand/             logo and monogram
    auth/              sign-in, sign-up and password reset forms
    ui/                Atelier Light building blocks (button, input, card, badge)
  lib/
    api/               route() wrapper, error codes, validation, cursors (API Design conventions)
    auth.ts            Better Auth config (email + password, Google, MongoDB)
    auth-client.ts     browser auth client
    session.ts         getSession / requirePageSession / requireApiSession
    db.ts              shared MongoClient
    email.ts           Resend, or log to console when no key
    env.ts             validated server environment
    cn.ts              class name helper
```

Every `/api` route is wrapped in `route()` from `src/lib/api/route.ts`, which adds `X-Request-Id` and
`Cache-Control: no-store`, checks the `Origin` on writes, and returns errors as
`{ "error": { "code", "message", "details" } }` with the codes listed in `src/lib/api/errors.ts`.

## Sign-in

Better Auth with email + password and Google, stored in MongoDB (`user`, `session`, `account`,
`verification`). Sessions last 7 days and refresh daily. The user record carries `timeZone` (from the
browser at sign-up), `defaultVoiceId` (George) and `onboardedAt`.

- Google sign-in appears enabled only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- Without `RESEND_API_KEY`, verification and reset emails are printed to the server log and email
  verification is not required (fine for internal testing).
- To try sign-in without Atlas: `DB_DRIVER=memory npm run dev` (data is lost on restart).

## Deploy (Vercel)

The Vercel project builds every push. `main` is production; `dev` gets a preview at its branch URL.

Environment variables to set in Vercel (Settings → Environment Variables, for Production and Preview):

| Key | Needed for |
| --- | --- |
| `MONGODB_URI` | Sign-in (required). Atlas must allow `0.0.0.0/0` in Network Access, since Vercel has no fixed IPs. |
| `BETTER_AUTH_SECRET` | Sign-in (required, 32+ characters). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in (optional). Redirect URI: `<site URL>/api/auth/callback/google`. |
| `RESEND_API_KEY` | Real verification and reset emails (optional). |

`APP_URL` can be left unset: it defaults to the deployment's own address.
