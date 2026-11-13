import { z } from "zod";

/**
 * Server environment, validated on first use. Each feature adds its keys here.
 * Keys for features that have not shipped yet stay optional.
 */
/**
 * On Vercel, fall back to the deployment's own address when APP_URL isn't set:
 * the production domain on main, the branch URL on previews (e.g. dev).
 */
function defaultAppUrl(): string {
  const v = process.env;
  const host =
    v.VERCEL_ENV === "production" ? v.VERCEL_PROJECT_PRODUCTION_URL : (v.VERCEL_BRANCH_URL ?? v.VERCEL_URL);
  return host ? `https://${host}` : "http://localhost:3000";
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default(defaultAppUrl),

  // F1 Sign-in
  MONGODB_URI: z.string().optional(),
  /** "memory" runs auth on an in-process store (tests, or where Atlas is unreachable). Never in production. */
  DB_DRIVER: z.enum(["mongodb", "memory"]).optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** When set, emails are sent through Resend and email verification is required. */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("ClipGuru <onboarding@resend.dev>"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment: ${problems}`);
    }
    cached = result.data;
  }
  return cached;
}

/**
 * Which database the app uses. Without MONGODB_URI, dev falls back to memory;
 * production refuses unless DB_DRIVER=memory is set on purpose (local end-to-end tests).
 */
export function dbDriver(): "mongodb" | "memory" {
  const e = env();
  if (e.DB_DRIVER) return e.DB_DRIVER;
  if (e.MONGODB_URI) return "mongodb";
  if (e.NODE_ENV === "production") throw new Error("MONGODB_URI is required in production.");
  return "memory";
}

export const googleEnabled = () => Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
