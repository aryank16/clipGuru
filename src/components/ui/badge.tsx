import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "dark" | "progress" | "success" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-surface text-espresso border border-hairline",
  dark: "bg-espresso-deep text-surface",
  progress: "bg-surface text-espresso border border-hairline",
  success: "bg-success/10 text-success border border-success/30",
  muted: "bg-surface text-taupe border border-hairline",
};

/** Small uppercase mono pill, as on video cards ("READY", "01:14"). */
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em]",
        tones[tone],
        className,
      )}
    >
      {tone === "progress" ? <span className="size-1.5 rounded-full bg-render-orange" aria-hidden /> : null}
      {children}
    </span>
  );
}
