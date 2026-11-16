"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { Voice } from "@/lib/voices";

/**
 * George / Alice radio list with a sample to play. Picking a voice shows it at once and calls `onPick`;
 * if that save fails, the list goes back to the last voice that was saved. Only the newest pick counts,
 * so quick changes can't end up showing a voice that was never saved.
 */
export function VoicePicker({
  current,
  voices,
  onPick,
}: {
  current: string;
  voices: Voice[];
  /** Saves the pick; resolves true when it was saved. */
  onPick: (id: string) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState(current);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const saved = useRef(current);
  const latest = useRef(0);

  useEffect(() => () => audio.current?.pause(), []);

  function toggle(v: Voice) {
    if (playing === v.id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(v.previewUrl);
    a.onended = () => setPlaying(null);
    audio.current = a;
    a.play().then(() => setPlaying(v.id)).catch(() => setPlaying(null));
  }

  async function choose(id: string) {
    if (id === selected) return;
    const call = ++latest.current;
    setSelected(id);
    const ok = await onPick(id);
    if (ok) saved.current = id;
    if (call !== latest.current) return;
    if (!ok) setSelected(saved.current);
  }

  return (
    <div role="radiogroup" aria-label="Default voice" className="flex flex-col gap-3">
      {voices.map((v) => {
        const on = v.id === selected;
        return (
          <div
            key={v.id}
            className={cn(
              "flex items-center gap-4 rounded-xl border px-4 py-4 transition-colors sm:px-5",
              on ? "border-sand-gold bg-sand-gold/10" : "border-hairline hover:border-taupe/40",
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(v.id)}
              className="flex min-w-0 flex-1 items-center gap-4 text-left"
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  on ? "border-espresso" : "border-taupe/50",
                )}
                aria-hidden
              >
                {on ? <span className="size-2.5 rounded-full bg-espresso" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">
                  {v.name}
                  <span className="ml-2 font-normal text-taupe">
                    {v.accent} {v.gender}
                  </span>
                </span>
                <span className="block text-sm text-taupe">{v.description}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggle(v)}
              aria-label={playing === v.id ? `Stop ${v.name} sample` : `Play ${v.name} sample`}
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors",
                playing === v.id
                  ? "border-espresso-deep bg-espresso-deep text-surface"
                  : "border-hairline bg-surface text-espresso hover:border-taupe/40",
              )}
            >
              {playing === v.id ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
