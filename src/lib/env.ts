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

/**
 * Keys and ids never contain spaces, so a value pasted twice or with stray line breaks
 * (easy to do in the Vercel form, where sensitive values can't be seen) reads as its first word.
 */
const oneToken = z.string().transform((v) => v.trim().split(/\s+/)[0] ?? "");

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
  /**
   * "true" makes new accounts confirm their email before signing in. Off by default: Resend's
   * test sender only reaches the Resend account owner until a domain is verified, and accounts
   * made before the switch have no confirmed email.
   */
  REQUIRE_EMAIL_VERIFICATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // F6 Idea chat
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
  /** Tried in order while GEMINI_MODEL is busy (comma separated). */
  GEMINI_FALLBACK_MODELS: z.string().default("gemini-3-flash-preview,gemini-2.5-flash"),
  /** "fake" answers chats with a scripted model (local end-to-end tests). Never in production. */
  AI_DRIVER: z.enum(["gemini", "fake"]).optional(),

  // F9 Voiceover
  ELEVENLABS_API_KEY: oneToken.optional(),
  ELEVENLABS_MODEL: z.string().default("eleven_multilingual_v2"),
  /** Cloudflare R2 (S3 API) for audio and video files. All four are needed. */
  R2_ACCOUNT_ID: oneToken.optional(),
  R2_ACCESS_KEY_ID: oneToken.optional(),
  R2_SECRET_ACCESS_KEY: oneToken.optional(),
  R2_BUCKET: oneToken.default("clipguru-media"),
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

/** Which model answers chats. "fake" only when asked for, and only alongside the memory database. */
export function aiDriver(): "gemini" | "fake" {
  return env().AI_DRIVER === "fake" && dbDriver() === "memory" ? "fake" : "gemini";
}

/** Who records the voice: ElevenLabs, the fake voice (local tests only), or nobody yet. */
export function voiceDriver(): "elevenlabs" | "fake" | null {
  if (aiDriver() === "fake") return "fake";
  return env().ELEVENLABS_API_KEY ? "elevenlabs" : null;
}

/** Where files go: R2, an in-process store (memory database only), or nowhere yet. */
export function storageDriver(): "r2" | "memory" | null {
  const e = env();
  if (e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY) return "r2";
  return dbDriver() === "memory" ? "memory" : null;
}
