import { betterAuth, type BetterAuthOptions } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { db, mongoClient } from "./db";
import { emailDeliveryEnabled, sendEmail } from "./email";
import { dbDriver, env, googleEnabled } from "./env";
import { DEFAULT_TIME_ZONE, DEFAULT_VOICE_ID, isValidTimeZone } from "./defaults";

/** In-process store used when DB_DRIVER=memory (tests, offline dev). */
const memoryDb: Record<string, Record<string, unknown>[]> = { user: [], session: [], account: [], verification: [] };

function database(): BetterAuthOptions["database"] {
  if (dbDriver() === "memory") return memoryAdapter(memoryDb);
  return mongodbAdapter(db(), { client: mongoClient() });
}

const DAY = 60 * 60 * 24;

function createAuth() {
  const e = env();
  return betterAuth({
    appName: "ClipGuru",
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.APP_URL],
    database: database(),

    // API Design → Authentication
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      // Verification is required only when emails can actually be delivered.
      requireEmailVerification: emailDeliveryEnabled(),
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your ClipGuru password",
          text: `Hi ${user.name},\n\nUse this link to choose a new password. It works once and expires in 1 hour.\n\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: emailDeliveryEnabled(),
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Confirm your email for ClipGuru",
          text: `Hi ${user.name},\n\nConfirm your email to start making videos. The link works once and expires in 1 hour.\n\n${url}`,
        });
      },
    },
    socialProviders: googleEnabled()
      ? { google: { clientId: e.GOOGLE_CLIENT_ID!, clientSecret: e.GOOGLE_CLIENT_SECRET!, prompt: "select_account" } }
      : {},
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    session: {
      expiresIn: 7 * DAY,
      updateAge: DAY,
    },

    // Database Design → Better Auth: user additional fields
    user: {
      additionalFields: {
        timeZone: { type: "string", required: false, defaultValue: DEFAULT_TIME_ZONE, input: true },
        defaultVoiceId: { type: "string", required: false, defaultValue: DEFAULT_VOICE_ID, input: false },
        onboardedAt: { type: "date", required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              timeZone: isValidTimeZone(user.timeZone) ? user.timeZone : DEFAULT_TIME_ZONE,
              defaultVoiceId: DEFAULT_VOICE_ID,
            },
          }),
        },
      },
    },

    rateLimit: {
      enabled: e.NODE_ENV === "production",
      window: 60,
      max: 100,
      customRules: { "/sign-in/*": { window: 60, max: 10 } },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { __auth?: Auth };

/** The Better Auth instance (created lazily so builds don't need runtime secrets). */
export function auth(): Auth {
  if (!globalForAuth.__auth) globalForAuth.__auth = createAuth();
  return globalForAuth.__auth;
}

export type Session = Auth["$Infer"]["Session"];
