import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const tones = {
  neutral: "border-line bg-surface",
  accent: "border-accent bg-accent/15",
  success: "border-success/30 bg-success/10",
  danger: "border-danger/30 bg-danger/10",
} as const;

/** A boxed message in the flow of the page: a heads-up, a success, or a problem. */
export function Notice({ tone = "neutral", className, role = "status", ...props }: ComponentProps<"div"> & { tone?: keyof typeof tones }) {
  return <div role={role} className={cn("rounded-xl border p-4 text-sm", tones[tone], className)} {...props} />;
}
