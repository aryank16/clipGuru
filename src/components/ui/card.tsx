import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}

/** Settings-style section header: "01 · CHANNEL INTEGRATION" eyebrow + title + optional right slot. */
export function SectionHeader({
  index,
  eyebrow,
  title,
  aside,
}: {
  index?: string;
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">
          {index ? `${index} · ` : ""}
          {eyebrow}
        </span>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      {aside}
    </div>
  );
}
