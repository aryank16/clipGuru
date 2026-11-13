"use client";

import { ArrowRight, MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { requestPasswordReset, resetPassword } from "@/lib/auth-client";
import { AuthHeading, StrengthBar, authErrorMessage } from "./parts";

function ErrorNote({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
      {text}
    </p>
  ) : null;
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setBusy(true);
    setError(null);
    const { error } = await requestPasswordReset({ email, redirectTo: "/reset-password" });
    setBusy(false);
    if (error) return setError(authErrorMessage(error.code, error.message));
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <MailCheck className="size-10" strokeWidth={1.5} />
        <AuthHeading>Check your inbox</AuthHeading>
        <p className="text-taupe">
          If an account exists for that email, a reset link is on its way. It works once and expires in 1 hour.
        </p>
        <Link href="/sign-in" className="text-sm font-medium hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <AuthHeading>Reset password</AuthHeading>
        <p className="text-taupe">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="name@studio.com" required />
        </Field>
        <ErrorNote text={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"} <ArrowRight className="size-4" />
        </Button>
      </form>
      <Link href="/sign-in" className="text-center text-sm text-taupe hover:text-espresso">
        Back to sign in
      </Link>
    </div>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (linkError || !token) {
    return (
      <div className="flex flex-col gap-6">
        <AuthHeading>Link expired</AuthHeading>
        <p className="text-taupe">{authErrorMessage("INVALID_TOKEN")}</p>
        <Link href="/forgot-password" className={buttonClasses("primary", "lg", "w-full")}>
          Get a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <AuthHeading>Password changed</AuthHeading>
        <p className="text-taupe">You can now sign in with your new password.</p>
        <Link href="/sign-in" className={buttonClasses("primary", "lg", "w-full")}>
          Sign in <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const confirm = String(new FormData(e.currentTarget).get("confirm"));
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    const { error } = await resetPassword({ newPassword: password, token: token! });
    setBusy(false);
    if (error) return setError(authErrorMessage(error.code, error.message));
    setDone(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading>New password</AuthHeading>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="New password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <StrengthBar password={password} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <ErrorNote text={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save new password"} <ArrowRight className="size-4" />
        </Button>
      </form>
    </div>
  );
}
