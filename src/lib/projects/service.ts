import { ApiError } from "../api/errors";
import { DEFAULT_VOICE_ID } from "../defaults";
import type { ProjectsRepo } from "./repo";
import { copyTitle, DEFAULT_TITLE, RESTORE_WINDOW_MS, toProject, type Project, type ProjectRecord } from "./types";

/**
 * Project actions from the API Design (Projects section). Pure over a repo so they run
 * the same against MongoDB and the in-memory store.
 */
export function projectService(repo: ProjectsRepo, now: () => Date = () => new Date()) {
  async function live(userId: string, id: string): Promise<ProjectRecord> {
    const r = await repo.get(userId, id);
    if (!r) throw new ApiError("NOT_FOUND");
    return r;
  }

  return {
    async create(userId: string, voiceId?: string | null): Promise<Project> {
      const t = now();
      const record = await repo.insert({
        id: repo.newId(),
        userId,
        title: DEFAULT_TITLE,
        status: "idea",
        step: "idea",
        brief: null,
        briefLockedAt: null,
        voiceId: voiceId || DEFAULT_VOICE_ID,
        currentVersion: 0,
        latestRenderId: null,
        hasChat: false,
        rev: 0,
        createdAt: t,
        updatedAt: t,
        deletedAt: null,
      });
      return toProject(record);
    },

    async get(userId: string, id: string): Promise<Project> {
      return toProject(await live(userId, id));
    },

    async patch(
      userId: string,
      id: string,
      body: { rev: number; title?: string; brief?: Record<string, unknown> | null; voiceId?: string },
    ): Promise<Project> {
      const current = await live(userId, id);
      if (current.rev !== body.rev) throw new ApiError("REV_CONFLICT", undefined, { currentRev: current.rev });
      if (body.brief !== undefined && current.briefLockedAt) {
        throw new ApiError("BRIEF_LOCKED", "The brief is locked once the storyboard exists.");
      }
      const { rev, ...patch } = body;
      const updated = await repo.update(userId, id, rev, patch, now());
      if (!updated) {
        // Lost a race with another write between the read and the update.
        const latest = await repo.get(userId, id);
        if (!latest) throw new ApiError("NOT_FOUND");
        throw new ApiError("REV_CONFLICT", undefined, { currentRev: latest.rev });
      }
      return toProject(updated);
    },

    async remove(userId: string, id: string): Promise<{ deletedAt: string; cancelledPosts: number }> {
      const t = now();
      const r = await repo.setDeleted(userId, id, t, t);
      if (!r) throw new ApiError("NOT_FOUND");
      // Scheduled posts arrive with F15; nothing to cancel yet.
      return { deletedAt: t.toISOString(), cancelledPosts: 0 };
    },

    async restore(userId: string, id: string): Promise<Project> {
      const deleted = await repo.getDeleted(userId, id);
      if (!deleted?.deletedAt || now().getTime() - deleted.deletedAt.getTime() > RESTORE_WINDOW_MS) {
        throw new ApiError("NOT_FOUND");
      }
      const r = await repo.setDeleted(userId, id, null, now());
      if (!r) throw new ApiError("NOT_FOUND");
      return toProject(r);
    },

    async duplicate(userId: string, id: string): Promise<Project> {
      const src = await live(userId, id);
      const t = now();
      // Storyboards arrive with F7; until then a copy is the title and brief, back at the idea step.
      const record = await repo.insert({
        ...src,
        id: repo.newId(),
        title: copyTitle(src.title),
        status: "idea",
        step: "idea",
        briefLockedAt: null,
        currentVersion: 0,
        latestRenderId: null,
        hasChat: false,
        rev: 0,
        createdAt: t,
        updatedAt: t,
        deletedAt: null,
      });
      return toProject(record);
    },
  };
}
