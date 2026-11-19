import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

const STEPS = [
  { key: "idea", label: "Idea" },
  { key: "storyboard", label: "Storyboard" },
  { key: "video", label: "Video" },
  { key: "post", label: "Post" },
] as const;

/** Back link and the four steps of a video. A step is a link once the video has reached it. */
export function StepTabs({
  current,
  projectId,
  hasStoryboard = false,
  hasVideo = false,
  canPost = false,
}: {
  current: (typeof STEPS)[number]["key"];
  projectId: string;
  hasStoryboard?: boolean;
  /** A render was started, so step 3 has something to show. */
  hasVideo?: boolean;
  /** The video is made, so step 4 can be opened. */
  canPost?: boolean;
}) {
  const index = STEPS.findIndex((s) => s.key === current);
  const hrefs: Partial<Record<(typeof STEPS)[number]["key"], string>> = hasStoryboard
    ? {
        idea: `/videos/${projectId}/idea`,
        storyboard: `/videos/${projectId}/storyboard`,
        ...(hasVideo ? { video: `/videos/${projectId}/video` } : {}),
        ...(hasVideo && canPost ? { post: `/videos/${projectId}/post` } : {}),
      }
    : {};
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
          const href = active ? undefined : hrefs[s.key];
          const label = (
            <>
              {String(i + 1).padStart(2, "0")}{" "}
              {/* Phones show only the current step's name, so four tabs fit. */}
              <span className={active ? undefined : "hidden sm:inline"}>{s.label}</span>
            </>
          );
          const cls = cn(
            "font-mono text-[11px] uppercase tracking-wider whitespace-nowrap sm:text-xs",
            active ? "font-semibold text-espresso" : href ? "text-taupe hover:text-espresso" : "text-taupe/70",
          );
          return (
            <li key={s.key} className="flex flex-col gap-2">
              {href ? (
                <Link href={href} className={cn(cls, "-my-3 py-3")} aria-label={`Step ${i + 1}: ${s.label}`}>
                  {label}
                </Link>
              ) : (
                <span aria-current={active ? "step" : undefined} className={cls}>
                  {label}
                </span>
              )}
              <span className={cn("h-1 rounded-full", i <= index || href ? "bg-sand-gold" : "bg-hairline")} aria-hidden />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
