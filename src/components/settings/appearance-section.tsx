"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { patchMe, Status, useSaver } from "@/components/account/save";
import { Card, SectionHeader } from "@/components/ui/card";
import { THEMES } from "@/design/tokens";
import { cn } from "@/lib/cn";
import { applyTheme, type ThemePref } from "@/lib/theme";

const BLURBS: Record<string, string> = {
  "atelier-light": "Warm paper and espresso. The default.",
  "atelier-dark": "The same studio at night.",
  blueprint: "Cool drafting paper with cobalt and highlighter.",
  grove: "Misty sage, deep teal and tangerine.",
  system: "Atelier Light by day, Atelier Dark when your device is dark.",
};

const OPTIONS: { id: ThemePref; label: string }[] = [
  ...THEMES.map((t) => ({ id: t.id, label: t.label })),
  { id: "system", label: "Match my device" },
];

/** Settings → Appearance: pick the app's theme. Applies at once, saved to the account. Videos are never themed. */
export function AppearanceSection({ current }: { current: ThemePref }) {
  const [theme, setTheme] = useState(current);
  const { state, error, run } = useSaver();

  async function pick(next: ThemePref) {
    const before = theme;
    setTheme(next);
    applyTheme(next);
    const out = await run(() => patchMe({ theme: next }));
    if (!out) {
      setTheme(before);
      applyTheme(before);
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-6 sm:p-8">
      <SectionHeader index="05" eyebrow="Appearance" title="Theme" aside={<Status state={state} error={error} />} />
      <p className="text-muted">Changes how ClipGuru looks on every device you sign in on. Your videos stay the same.</p>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Theme</legend>
        {OPTIONS.map((o) => {
          const on = theme === o.id;
          return (
            <label
              key={o.id}
              className={cn(
                "flex cursor-pointer flex-col gap-3 rounded-xl border bg-surface p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
                on ? "border-ink" : "border-line hover:border-muted/60",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={o.id}
                checked={on}
                onChange={() => pick(o.id)}
                className="sr-only"
              />
              <ThemePreview id={o.id} />
              <span className="flex items-start justify-between gap-3 px-1">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">{o.label}</span>
                  <span className="text-sm text-muted">{BLURBS[o.id]}</span>
                </span>
                {on ? <Check className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden /> : null}
              </span>
            </label>
          );
        })}
      </fieldset>
    </Card>
  );
}

/** A tiny mock screen drawn in the theme's own tokens (data-theme scopes the variables). */
function ThemePreview({ id }: { id: ThemePref }) {
  if (id === "system") {
    return (
      <span className="grid h-24 grid-cols-2 overflow-hidden rounded-lg border border-line" aria-hidden>
        <Mock theme="atelier-light" />
        <Mock theme="atelier-dark" />
      </span>
    );
  }
  return (
    <span className="block h-24 overflow-hidden rounded-lg border border-line" aria-hidden>
      <Mock theme={id} />
    </span>
  );
}

function Mock({ theme }: { theme: string }) {
  return (
    <span data-theme={theme} className="flex h-full gap-2 bg-canvas p-2.5">
      <span className="flex w-1/4 flex-col gap-1.5 rounded-md bg-surface p-1.5">
        <span className="size-3 rounded-sm bg-ink-strong" />
        <span className="h-1 w-full rounded-full bg-line" />
        <span className="h-1 w-3/4 rounded-full bg-line" />
      </span>
      <span className="flex flex-1 flex-col gap-1.5 rounded-md border border-line bg-surface p-2 shadow-card">
        <span className="h-1.5 w-2/3 rounded-full bg-ink" />
        <span className="h-1 w-1/2 rounded-full bg-muted/60" />
        <span className="mt-auto flex items-center gap-1.5">
          <span className="h-3.5 w-10 rounded-md bg-ink-strong" />
          <span className="h-3.5 w-6 rounded-md bg-accent" />
        </span>
      </span>
    </span>
  );
}
