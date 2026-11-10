import { z } from "zod";

/**
 * Server environment, validated on first use. Each feature adds its keys here
 * (F1: MongoDB + Better Auth + Google; F6: Gemini; F9: ElevenLabs + R2; ...).
 * Optional keys stay optional until the feature that needs them ships.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      const missing = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment: ${missing}`);
    }
    cached = result.data;
  }
  return cached;
}
