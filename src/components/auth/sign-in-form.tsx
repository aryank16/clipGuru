"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";
import { AuthHeading, GoogleButton, OrDivider, authErrorMessage } from "./parts";

/** Only same-app paths are allowed as a post-sign-in destination. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/videos";
}

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      rememberMe: true,
      callbackURL: next,
    });
    if (error) {
      setError(authErrorMessage(error.code, error.message));
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading>Sign in</AuthHeading>
      <GoogleButton enabled={googleEnabled} callbackURL={next} />
      <OrDivider />
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="name@studio.com" required />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          aside={
            <Link href="/forgot-password" className="text-sm text-taupe hover:text-espresso">
              Forgot password?
            </Link>
          }
        >
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        {error ? (
          <p role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"} <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="text-center text-sm text-taupe">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-espresso hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
