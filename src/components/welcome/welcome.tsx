"use client";

import { ArrowRight, Clapperboard, Lightbulb, Loader2, PanelsTopLeft, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { patchMe, Status, useSaver } from "@/components/account/save";
import { VoicePicker } from "@/components/account/voice-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Voice } from "@/lib/voices";

const STEPS = [
  { icon: Lightbulb, title: "Idea", text: "Chat about a topic until the idea is clear." },
  { icon: PanelsTopLeft, title: "Storyboard", text: "Review the script and scenes, and ask for changes." },
  { icon: Clapperboard, title: "Video", text: "Get a 60–90 second explainer with voiceover and captions." },
  { icon: Send, title: "Post", text: "Download it, or post or schedule it to Instagram." },
];

export function Welcome({ firstName, voices, currentVoice }: { firstName: string; voices: Voice[]; currentVoice: string }) {
  const router = useRouter();
  const voiceSaver = useSaver();
  const [leaving, setLeaving] = useState<"start" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start and Skip wait for a voice save in progress, so the first video uses the voice just picked.
  const busy = leaving !== null || voiceSaver.state === "saving";

  /** Marks the welcome as seen, then moves on; on failure stays here and says why. */
  async function finish(to: "/new" | "/videos", which: "start" | "skip") {
    setLeaving(which);
    setError(null);
    try {
      await patchMe({ onboarded: true });
      router.replace(to);
      router.refresh();
    } catch (e) {
      setLeaving(null);
      setError(e instanceof TypeError ? "Couldn't reach ClipGuru. Check your connection and try again." : (e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-10 sm:gap-14">
      <header className="flex flex-col gap-5">
        <span className="eyebrow">Getting started</span>
        <h1 className="break-words font-display text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
          Welcome,
          <br />
          {firstName}.
        </h1>
        <p className="max-w-xl text-lg text-taupe">Two quick things and you&apos;re ready to make your first explainer.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <span className="font-mono text-4xl text-espresso/80">01</span>
            <Status state={voiceSaver.state} error={voiceSaver.error} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold">Pick your narrator</h2>
            <p className="text-taupe">Play a sample and choose the voice for your videos. You can change it any time in Settings.</p>
          </div>
          <VoicePicker
            current={currentVoice}
            voices={voices}
            onPick={async (id) => Boolean(await voiceSaver.run(() => patchMe({ defaultVoiceId: id })))}
          />
        </Card>

        <Card className="flex flex-col gap-6 p-6 sm:p-8">
          <span className="font-mono text-4xl text-espresso/80">02</span>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold">Make your first video</h2>
            <p className="text-taupe">
              Start with a topic you know well. ClipGuru turns it into a short explainer reel, ready to download or post.
            </p>
          </div>
          <div className="mt-auto flex flex-col gap-3">
            <Button size="lg" className="w-full justify-between" disabled={busy} onClick={() => finish("/new", "start")}>
              Start with an idea
              {leaving === "start" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            </Button>
            <p className="text-sm text-taupe">Instagram can be connected later, in Settings.</p>
          </div>
        </Card>
      </div>

      <section className="flex flex-col gap-5" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="eyebrow border-b border-hairline pb-4">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card className="flex h-full flex-col gap-3 bg-surface/60 p-5">
                <div className="flex items-center justify-between">
                  <s.icon className="size-5 text-espresso" aria-hidden />
                  <span className="font-mono text-xs uppercase text-taupe">Step {i + 1}</span>
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-taupe">{s.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-col items-center gap-2 pb-4">
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button variant="ghost" disabled={busy} onClick={() => finish("/videos", "skip")}>
          {leaving === "skip" ? <Loader2 className="size-4 animate-spin" /> : null}
          Skip for now, go to My videos
        </Button>
      </div>
    </div>
  );
}
