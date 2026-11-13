import { env } from "./env";

type Email = { to: string; subject: string; text: string };

/** Email can actually reach an inbox only when a provider key is configured. */
export const emailDeliveryEnabled = () => Boolean(env().RESEND_API_KEY);

/** New accounts must confirm their email: needs delivery and the explicit switch. */
export const emailVerificationRequired = () => emailDeliveryEnabled() && env().REQUIRE_EMAIL_VERIFICATION;

/**
 * Sends a transactional email through Resend. Without RESEND_API_KEY (local dev,
 * internal testing) the email is printed to the server log instead, so links can
 * still be followed by hand.
 */
export async function sendEmail({ to, subject, text }: Email): Promise<void> {
  const key = env().RESEND_API_KEY;
  if (!key) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env().EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) {
    // Logged, not thrown: a failed send must not reveal whether an account exists. Check Vercel logs.
    console.error(`[email] send failed to=${to} status=${res.status} ${await res.text()}`);
  }
}
