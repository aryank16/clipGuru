"use client";

import { ArrowRight, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signUp } from "@/lib/auth-client";
import { AuthHeading, GoogleButton, OrDivider, StrengthBar, authErrorMessage } from "./parts";

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name")).trim();
    const email = String(form.get("email")).trim();
    if (!name) return setError("Please add your name.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    setError(null);
    const { data, error } = await signUp.email({
      name,
      email,
      password,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      callbackURL: "/videos",
    });
    if (error) {
      setError(authErrorMessage(error.code, error.message));
      setBusy(false);
      return;
    }
    // No token means email verification is required before the first sign-in.
    if (!data?.token) {
      setSentTo(email);
      return;
    }
    router.replace("/videos");
    router.refresh();
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <MailCheck className="size-10 text-espresso" strokeWidth={1.5} />
        <AuthHeading>Check your inbox</AuthHeading>
        <p className="text-taupe">
          We sent a confirmation link to <span className="font-medium text-espresso">{sentTo}</span>. It expires in 1
          hour. Open it on this device to finish creating your account.
        </p>
        <Link href="/sign-in" className="text-sm font-medium text-espresso hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading>Create account</AuthHeading>
      <GoogleButton enabled={googleEnabled} callbackURL="/videos" />
      <OrDivider />
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" placeholder="Julian Sterling" required maxLength={80} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="name@studio.com" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <StrengthBar password={password} />
        </Field>
        {error ? (
          <p role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"} <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="text-center text-sm text-taupe">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-espresso hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
