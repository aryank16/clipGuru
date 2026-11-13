import type { ProjectStatus } from "@/lib/projects/types";

import type { Tone } from "@/components/ui/badge";

/** Short badge text and tone for a card (full labels live in STATUS_LABELS). */
export const STATUS_BADGE: Record<ProjectStatus, { label: string; tone: Tone }> = {
  idea: { label: "Draft", tone: "muted" },
  storyboard: { label: "Storyboard", tone: "neutral" },
  generating: { label: "Rendering", tone: "progress" },
  ready: { label: "Ready", tone: "neutral" },
  attention: { label: "Needs attention", tone: "danger" },
  scheduled: { label: "Scheduled", tone: "neutral" },
  posted: { label: "Posted", tone: "success" },
};
