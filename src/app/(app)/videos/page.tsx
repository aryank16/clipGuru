import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card } from "@/components/ui/card";
import { requirePageSession } from "@/lib/session";

export const metadata: Metadata = { title: "My videos" };

/** Temporary signed-in landing page for F1. F2 (dashboard shell) and F3 (My videos) replace it. */
export default function VideosPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12 sm:px-8">
      <Logo />
      <Suspense fallback={<Card className="h-40 animate-pulse" />}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const { user } = await requirePageSession();
  return (
    <Card className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Signed in</span>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">Hello, {user.name}</h1>
        <p className="text-taupe">
          You&apos;re signed in as <span className="text-espresso">{user.email}</span>. Your videos will show here once
          the dashboard is built.
        </p>
      </div>
      <dl className="grid gap-3 font-mono text-xs text-taupe sm:grid-cols-2">
        <div>
          <dt className="eyebrow">Time zone</dt>
          <dd className="mt-1 text-espresso">{user.timeZone}</dd>
        </div>
        <div>
          <dt className="eyebrow">Default voice</dt>
          <dd className="mt-1 text-espresso">George (British male)</dd>
        </div>
      </dl>
      <div>
        <SignOutButton />
      </div>
    </Card>
  );
}
