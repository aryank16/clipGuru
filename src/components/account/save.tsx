"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Me } from "@/lib/me";

export type SaveState = "idle" | "saving" | "saved" | "error";

/** PATCH /api/me. Throws with the server's message (first field error, else the error message). */
export async function patchMe(
  body: Partial<Pick<Me, "name" | "timeZone" | "defaultVoiceId">> & { onboarded?: true },
): Promise<Me> {
  const res = await fetch("/api/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((Object.values(data?.error?.details ?? {})[0] as string) ?? data?.error?.message ?? "Couldn't save.");
  return data as Me;
}

export function Status({ state, error }: { state: SaveState; error?: string | null }) {
  if (state === "saving") return <span className="text-sm text-taupe">Saving…</span>;
  if (state === "saved")
    return (
      <span className="flex items-center gap-1.5 text-sm text-success" role="status">
        <Check className="size-4" /> Saved
      </span>
    );
  if (state === "error") return <span className="text-sm text-danger" role="alert">{error}</span>;
  return null;
}

/** Runs a save, shows Saving… / Saved / the error, and clears "Saved" after a moment. */
export function useSaver() {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    clearTimeout(timer.current);
    setState("saving");
    setError(null);
    try {
      const out = await fn();
      setState("saved");
      timer.current = setTimeout(() => setState("idle"), 2500);
      return out;
    } catch (e) {
      setState("error");
      setError((e as Error).message);
    }
  }
  return { state, error, run };
}
