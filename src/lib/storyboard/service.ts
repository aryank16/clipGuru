import { ApiError } from "../api/errors";
import { briefComplete, toBrief, type Brief } from "../brief";
import type { ProjectsRepo } from "../projects/repo";
import { toProject, type Project, type ProjectRecord } from "../projects/types";
import type { StoryboardRepo } from "./repo";
import {
  changedScenes,
  estSeconds,
  LENGTH_RANGE,
  MIN_SCENES,
  repairCues,
  toStoryboardVersion,
  wordCount,
  type Scene,
  type Storyboard,
  type StoryboardVersion,
  type StoryboardVersionRecord,
} from "./types";

/** The AI side, injected so tests and the fake driver can stand in for Gemini. */
export type StoryboardWriter = {
  write(brief: Brief): Promise<Storyboard>;
  revise(current: Storyboard, instruction: string): Promise<Storyboard>;
  rewriteScene(current: Storyboard, index: number, instruction?: string): Promise<Scene>;
};

export type Warning = "LENGTH_OUT_OF_RANGE";
export type Saved = { version: StoryboardVersion; project: Project; rev: number; warnings: Warning[] };
export type VersionSummary = Omit<StoryboardVersion, "storyboard">;

type Deps = { projects: ProjectsRepo; storyboards: StoryboardRepo; writer: StoryboardWriter; now?: () => Date };

function warningsFor(sb: Storyboard): Warning[] {
  const s = estSeconds(sb);
  return s < LENGTH_RANGE.min || s > LENGTH_RANGE.max ? ["LENGTH_OUT_OF_RANGE"] : [];
}

/**
 * Storyboard actions from the API Design (Storyboard section). Every change is a new version;
 * undo copies the version before into a new one, so history only grows.
 */
export function storyboardService({ projects, storyboards, writer, now = () => new Date() }: Deps) {
  async function live(userId: string, projectId: string, rev?: number): Promise<ProjectRecord> {
    const p = await projects.get(userId, projectId);
    if (!p) throw new ApiError("NOT_FOUND");
    if (rev !== undefined && p.rev !== rev) throw new ApiError("REV_CONFLICT", undefined, { currentRev: p.rev });
    return p;
  }

  async function currentOf(p: ProjectRecord): Promise<StoryboardVersionRecord> {
    const v = p.currentVersion > 0 ? await storyboards.get(p.userId, p.id, p.currentVersion) : null;
    if (!v) throw new ApiError("NOT_FOUND", "This video doesn't have a storyboard yet.");
    return v;
  }

  /**
   * Saves `next` as the version after the project's current one and moves the project to it.
   * A rev or version race leaves nothing behind and is a REV_CONFLICT.
   */
  async function commit(
    p: ProjectRecord,
    prev: StoryboardVersionRecord | null,
    next: Storyboard,
    meta: { createdBy: "ai" | "user"; changeNote: string | null; parentVersion?: number | null },
  ): Promise<Saved> {
    const storyboard: Storyboard = { ...next, scenes: next.scenes.map(repairCues) };
    if (storyboard.scenes.length < MIN_SCENES) {
      throw new ApiError("TOO_FEW_SCENES", `A storyboard needs at least ${MIN_SCENES} scenes.`);
    }
    const t = now();
    const record: StoryboardVersionRecord = {
      id: storyboards.newId(),
      projectId: p.id,
      userId: p.userId,
      version: p.currentVersion + 1,
      storyboard,
      wordCount: wordCount(storyboard),
      estSeconds: estSeconds(storyboard),
      createdBy: meta.createdBy,
      changeNote: meta.changeNote,
      changedScenes: changedScenes(prev?.storyboard ?? null, storyboard),
      parentVersion: meta.parentVersion !== undefined ? meta.parentVersion : prev ? prev.version : null,
      createdAt: t,
    };
    const conflict = async () => {
      const latest = await projects.get(p.userId, p.id);
      if (!latest) return new ApiError("NOT_FOUND");
      return record.version === 1 && latest.currentVersion > 0
        ? new ApiError("STORYBOARD_EXISTS", "This video already has a storyboard.")
        : new ApiError("REV_CONFLICT", undefined, { currentRev: latest.rev });
    };
    if (!(await storyboards.insert(record))) throw await conflict();
    const first = record.version === 1;
    const updated = await projects.update(
      p.userId,
      p.id,
      p.rev,
      first
        ? { currentVersion: 1, status: "storyboard", step: "storyboard", briefLockedAt: t }
        : { currentVersion: record.version },
      t,
    );
    if (!updated) {
      await storyboards.remove(p.userId, p.id, record.version);
      throw await conflict();
    }
    return { version: toStoryboardVersion(record), project: toProject(updated), rev: updated.rev, warnings: warningsFor(storyboard) };
  }

  return {
    commit,
    currentOf,

    /** POST /storyboard: version 1 from the brief. Locks the brief and moves the video to step 2. */
    async generate(userId: string, projectId: string, rev: number): Promise<Saved> {
      const p = await live(userId, projectId, rev);
      if (p.currentVersion > 0) throw new ApiError("STORYBOARD_EXISTS", "This video already has a storyboard.");
      const brief = toBrief(p.brief);
      if (!briefComplete(brief)) throw new ApiError("BRIEF_INCOMPLETE", "Add a topic and at least one key point first.");
      const storyboard = await writer.write(brief);
      return commit(p, null, storyboard, { createdBy: "ai", changeNote: null });
    },

    /** GET /storyboard: the current version, or an older one. */
    async get(userId: string, projectId: string, version?: number): Promise<StoryboardVersion> {
      const p = await live(userId, projectId);
      if (version === undefined) return toStoryboardVersion(await currentOf(p));
      const v = await storyboards.get(userId, projectId, version);
      if (!v) throw new ApiError("NOT_FOUND", "That version doesn't exist.");
      return toStoryboardVersion(v);
    },

    /** PUT /storyboard: a direct edit, based on the version the editor last saw. */
    async save(
      userId: string,
      projectId: string,
      body: { rev: number; baseVersion: number; storyboard: Storyboard },
    ): Promise<Saved> {
      const p = await live(userId, projectId, body.rev);
      const prev = await currentOf(p);
      if (body.baseVersion !== prev.version) {
        throw new ApiError("REV_CONFLICT", undefined, { currentRev: p.rev, currentVersion: prev.version });
      }
      return commit(p, prev, body.storyboard, { createdBy: "user", changeNote: null });
    },

    /** POST /storyboard/scenes/:index/regenerate: a fresh take on one scene. */
    async regenerateScene(
      userId: string,
      projectId: string,
      index: number,
      body: { rev: number; instruction?: string },
    ): Promise<Saved> {
      const p = await live(userId, projectId, body.rev);
      const prev = await currentOf(p);
      if (!prev.storyboard.scenes[index]) throw new ApiError("SCENE_NOT_FOUND", "That scene doesn't exist.");
      const scene = await writer.rewriteScene(prev.storyboard, index, body.instruction);
      const scenes = prev.storyboard.scenes.map((s, i) => (i === index ? scene : s));
      // Scene 1 is always the title card; a rewrite of it stays one.
      return commit(p, prev, { ...prev.storyboard, scenes }, {
        createdBy: "ai",
        changeNote: body.instruction ? `Scene ${index + 1}: ${body.instruction}` : `New take on scene ${index + 1}`,
      });
    },

    /** POST /storyboard/undo: back to the version this one was made from, as a new version. */
    async undo(userId: string, projectId: string, rev: number): Promise<Saved> {
      const p = await live(userId, projectId, rev);
      const prev = await currentOf(p);
      const target = prev.parentVersion ? await storyboards.get(userId, projectId, prev.parentVersion) : null;
      if (!target) throw new ApiError("NOTHING_TO_UNDO", "There's nothing to undo.");
      return commit(p, prev, target.storyboard, {
        createdBy: "user",
        changeNote: `Back to version ${target.version}`,
        parentVersion: target.parentVersion,
      });
    },

    /** GET /storyboard/versions: newest first. */
    async versions(userId: string, projectId: string): Promise<VersionSummary[]> {
      await live(userId, projectId);
      return (await storyboards.list(userId, projectId)).map((r) => ({
        version: r.version,
        wordCount: r.wordCount,
        estSeconds: r.estSeconds,
        createdBy: r.createdBy,
        changeNote: r.changeNote,
        changedScenes: r.changedScenes,
        canUndo: r.parentVersion !== null,
        createdAt: r.createdAt.toISOString(),
      }));
    },
  };
}
