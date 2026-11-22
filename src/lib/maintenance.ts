import "server-only";
import type { ChatRepo } from "./chat/repo";
import type { InstagramClient } from "./instagram/client";
import type { InstagramRepo } from "./instagram/repo";
import { classify } from "./posts/job";
import type { PostsRepo } from "./posts/repo";
import { RESTORE_WINDOW_MS } from "./projects/types";
import type { ProjectsRepo } from "./projects/repo";
import type { RenderRepo } from "./render/repo";
import type { Storage } from "./storage";
import type { StoryboardRepo } from "./storyboard/repo";
import type { VoiceoverRepo } from "./voiceover/repo";

/** Where a project's files live in storage (voice, renders, covers). */
export const projectPrefix = (userId: string, projectId: string) => `users/${userId}/projects/${projectId}/`;

export type PurgeDeps = {
  projects: ProjectsRepo;
  posts: PostsRepo;
  chat: ChatRepo;
  storyboards: StoryboardRepo;
  voiceovers: VoiceoverRepo;
  renders: RenderRepo;
  storage: Storage | null;
  now?: () => Date;
};

/**
 * Daily: permanently removes videos that have been in the trash longer than the 30-day restore
 * window, with everything that belongs to them (posts, chat, storyboard versions, voiceovers,
 * renders and their files). Files go first, so a failure leaves the record to retry tomorrow
 * rather than orphaned files nobody can find. Returns how many videos went.
 */
export async function purgeDeletedProjects(deps: PurgeDeps, limit = 50): Promise<number> {
  const now = deps.now?.() ?? new Date();
  const due = await deps.projects.listDeletedBefore(new Date(now.getTime() - RESTORE_WINDOW_MS), limit);
  let n = 0;
  for (const p of due) {
    try {
      await deps.storage?.deletePrefix(projectPrefix(p.userId, p.id));
      await deps.posts.deleteForProject(p.userId, p.id);
      await deps.chat.deleteForProject(p.userId, p.id);
      await deps.storyboards.deleteForProject(p.userId, p.id);
      await deps.voiceovers.deleteForProject(p.userId, p.id);
      await deps.renders.deleteForProject(p.userId, p.id);
      if (await deps.projects.purge(p.userId, p.id)) n++;
    } catch (err) {
      console.error("[purge] couldn't remove a deleted video; will retry tomorrow", p.id, err);
    }
  }
  return n;
}

export type HealthDeps = {
  instagram: InstagramRepo;
  client: InstagramClient | null;
  /** Decrypts the stored token. */
  open: (sealed: string) => string;
  now?: () => Date;
};

/**
 * Daily: asks Meta whether each linked Instagram account still works, so a revoked or expired
 * connection shows "Reconnect" in the app before a scheduled post fails on it. Only a clear
 * "this token no longer works" answer flags the account; Meta being busy changes nothing.
 * Returns how many accounts were flagged.
 */
export async function checkInstagramConnections(deps: HealthDeps, limit = 200): Promise<number> {
  if (!deps.client) return 0;
  const now = deps.now?.() ?? new Date();
  let flagged = 0;
  for (const a of await deps.instagram.listConnected(limit)) {
    let broken = a.tokenExpiresAt !== null && a.tokenExpiresAt.getTime() <= now.getTime();
    if (!broken) {
      try {
        const { accounts } = await deps.client.accounts(deps.open(a.tokenEnc));
        // The person took this Instagram account away from the app.
        broken = !accounts.some((x) => x.id === a.igUserId);
      } catch (err) {
        broken = classify(err).kind === "reconnect";
        if (!broken) console.error("[instagram] health check couldn't reach Meta", a.userId, err);
      }
    }
    if (broken) {
      await deps.instagram.markReconnectNeeded(a.userId, now);
      console.warn("[instagram] connection stopped working; the person will be asked to reconnect", a.userId);
      flagged++;
    }
  }
  return flagged;
}
