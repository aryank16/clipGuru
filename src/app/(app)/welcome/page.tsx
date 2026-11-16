import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Welcome } from "@/components/welcome/welcome";
import { firstName } from "@/lib/initials";
import { toMe } from "@/lib/me";
import { requirePageSession } from "@/lib/session";
import { VOICES } from "@/lib/voices";

export const metadata: Metadata = { title: "Welcome" };

/** First-run screen after sign-up. Shown once: after "Start" or "Skip", My videos is home. */
export default function WelcomePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}>
      <WelcomeLoader />
    </Suspense>
  );
}

async function WelcomeLoader() {
  const { user } = await requirePageSession();
  const me = toMe(user);
  if (me.onboarded) redirect("/videos");
  return <Welcome firstName={firstName(me.name)} voices={VOICES} currentVoice={me.defaultVoiceId ?? VOICES[0].id} />;
}

