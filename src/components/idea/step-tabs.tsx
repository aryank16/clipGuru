import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

const STEPS = [
  { key: "idea", label: "Idea" },
  { key: "storyboard", label: "Storyboard" },
  { key: "video", label: "Video" },
  { key: "post", label: "Post" },
] as const;

/** Back link and the four steps of a video. Later steps open as their features land. */
export function StepTabs({ current }: { current: (typeof STEPS)[number]["key"] }) {
  const index = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Video steps" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <Link
        href="/videos"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-taupe hover:text-espresso"
      >
        <ArrowLeft className="size-4" /> My videos
      </Link>
      <ol className="grid grid-cols-4 gap-2 sm:flex sm:gap-6">
        {STEPS.map((s, i) => {
          const active = i === index;
          return (
            <li key={s.key} className="flex flex-col gap-2">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "font-mono text-[11px] uppercase tracking-wider whitespace-nowrap sm:text-xs",
                  active ? "font-semibold text-espresso" : "text-taupe/70",
                )}
              >
                {String(i + 1).padStart(2, "0")}{" "}
                {/* Phones show only the current step's name, so four tabs fit. */}
                <span className={active ? undefined : "hidden sm:inline"}>{s.label}</span>
              </span>
              <span className={cn("h-1 rounded-full", i <= index ? "bg-sand-gold" : "bg-hairline")} aria-hidden />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
