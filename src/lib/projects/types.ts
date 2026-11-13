/** Projects (Database Design → projects; API Design → Project). */
export const PROJECT_STATUSES = ["idea", "storyboard", "generating", "ready", "attention", "scheduled", "posted"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STEPS = ["idea", "storyboard", "generate", "post"] as const;
export type ProjectStep = (typeof PROJECT_STEPS)[number];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: "Idea in progress",
  storyboard: "Storyboard ready",
  generating: "Generating",
  ready: "Video ready",
  attention: "Needs attention",
  scheduled: "Scheduled",
  posted: "Posted",
};

/** Library filter tabs and the statuses each one shows. */
export const PROJECT_FILTERS = ["all", "drafts", "rendering", "ready", "scheduled", "posted"] as const;
export type ProjectFilter = (typeof PROJECT_FILTERS)[number];

export const FILTER_STATUSES: Record<ProjectFilter, ProjectStatus[] | null> = {
  all: null,
  drafts: ["idea", "storyboard", "attention"],
  rendering: ["generating"],
  ready: ["ready"],
  scheduled: ["scheduled"],
  posted: ["posted"],
};

export const FILTER_LABELS: Record<ProjectFilter, string> = {
  all: "All",
  drafts: "Drafts",
  rendering: "Rendering",
  ready: "Ready",
  scheduled: "Scheduled",
  posted: "Posted",
};

export type FilterCounts = Record<ProjectFilter, number>;

export const TITLE_MAX = 120;
export const DEFAULT_TITLE = "Untitled video";
/** How long a deleted video can be brought back. */
export const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Stored shape (ids as strings so both drivers share it). */
export type ProjectRecord = {
  id: string;
  userId: string;
  title: string;
  status: ProjectStatus;
  step: ProjectStep;
  brief: Record<string, unknown> | null;
  briefLockedAt: Date | null;
  voiceId: string;
  currentVersion: number;
  latestRenderId: string | null;
  hasChat: boolean;
  rev: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/** What the API returns. */
export type Project = {
  id: string;
  title: string;
  status: ProjectStatus;
  step: ProjectStep;
  brief: Record<string, unknown> | null;
  voiceId: string;
  currentVersion: number;
  thumbnailUrl: string | null;
  durationSec: number | null;
  rev: number;
  createdAt: string;
  updatedAt: string;
};

export function toProject(r: ProjectRecord): Project {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    step: r.step,
    brief: r.brief,
    voiceId: r.voiceId,
    currentVersion: r.currentVersion,
    // Thumbnails and durations come from renders (F12).
    thumbnailUrl: null,
    durationSec: null,
    rev: r.rev,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** "Photosynthesis" → "Photosynthesis (copy)", kept within the title limit. */
export function copyTitle(title: string): string {
  const suffix = " (copy)";
  return title.slice(0, TITLE_MAX - suffix.length).trimEnd() + suffix;
}
