"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

export function AuthHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-4xl font-black uppercase tracking-tight">{children}</h2>;
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-4 text-sm text-taupe" role="separator">
      <span className="h-px flex-1 bg-hairline" />
      or
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}

/** "Continue with Google". Disabled (with a reason) until Google keys are configured. */
export function GoogleButton({ enabled, callbackURL }: { enabled: boolean; callbackURL: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={!enabled || busy}
        onClick={async () => {
          setBusy(true);
          const { error } = await signIn.social({ provider: "google", callbackURL });
          if (error) setBusy(false);
        }}
        className={cn(
          "flex h-14 w-full items-center justify-center gap-3 rounded-lg border border-hairline bg-surface text-[15px] font-medium shadow-sm transition-colors",
          "hover:bg-white disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <GoogleMark />
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {!enabled ? <p className="text-center text-xs text-taupe">Google sign-in isn&apos;t set up yet.</p> : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** 0–3 score used by the sign-up strength bar. */
export function passwordScore(pw: string): number {
  if (pw.length < 8) return pw.length === 0 ? 0 : 1;
  let score = 1;
  if (/[a-z]/.test(pw) && /[A-Z0-9]/.test(pw)) score++;
  if (pw.length >= 12 || /[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

export function StrengthBar({ password }: { password: string }) {
  const score = passwordScore(password);
  const label = ["", "Too short or weak", "Okay", "Strong"][score];
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 rounded-full", i <= score ? "bg-sand-gold" : "bg-hairline")} />
        ))}
      </div>
      {label ? <span className="text-xs text-taupe">{label}</span> : null}
    </div>
  );
}

/** Friendly text for Better Auth error codes. */
export function authErrorMessage(code: string | undefined, fallback?: string): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match.";
    case "EMAIL_NOT_VERIFIED":
      return "Please confirm your email first. We've sent you a new link.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Try signing in.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters.";
    case "PASSWORD_TOO_LONG":
      return "Use 128 characters or fewer.";
    case "INVALID_TOKEN":
      return "This link has expired or was already used. Ask for a new one.";
    case "TOO_MANY_REQUESTS":
      return "Too many attempts. Wait a minute and try again.";
    default:
      return fallback || "Something went wrong. Please try again.";
  }
}
