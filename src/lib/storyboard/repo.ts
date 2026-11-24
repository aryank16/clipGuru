import "server-only";
import { randomBytes } from "node:crypto";
import { MongoServerError, ObjectId, type Collection } from "mongodb";
import { db } from "../db";
import { dbDriver } from "../env";
import type { StoryboardVersionRecord } from "./types";

/** Storyboard versions (Database Design → storyboard_versions). Append-only; every method is scoped to one user. */
export interface StoryboardRepo {
  /** Returns false when that version number already exists for the project (two writers raced). */
  insert(record: StoryboardVersionRecord): Promise<boolean>;
  get(userId: string, projectId: string, version: number): Promise<StoryboardVersionRecord | null>;
  /** Newest first, without the storyboards themselves. */
  list(userId: string, projectId: string): Promise<Omit<StoryboardVersionRecord, "storyboard">[]>;
  /** Removes one version by its id (an insert whose project update didn't happen). */
  remove(userId: string, id: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<number>;
  /** Hard-deletes everything of one project (the daily purge of videos deleted over 30 days ago). */
  deleteForProject(userId: string, projectId: string): Promise<number>;
  newId(): string;
}

// ── MongoDB ──────────────────────────────────────────────────────────────────

type Doc = Omit<StoryboardVersionRecord, "id"> & { _id: ObjectId };

let indexesReady: Promise<unknown> | null = null;

function collection(): Collection<Doc> {
  const c = db().collection<Doc>("storyboard_versions");
  indexesReady ??= c
    .createIndexes([{ key: { projectId: 1, version: -1 }, unique: true }, { key: { userId: 1 } }])
    .then(() => true)
    .catch((err) => {
      indexesReady = null;
      console.error("[storyboard] index creation failed", err);
    });
  return c;
}

function fromDoc({ _id, ...rest }: Doc): StoryboardVersionRecord {
  return { id: _id.toHexString(), ...rest };
}

const mongoRepo: StoryboardRepo = {
  newId: () => new ObjectId().toHexString(),

  async insert(record) {
    const { id, ...rest } = record;
    // The unique index is what stops two versions with one number, so it must exist first.
    await collection();
    if (!(await indexesReady)) {
      indexesReady = null;
      throw new Error("storyboard_versions unique index is missing");
    }
    try {
      await collection().insertOne({ _id: new ObjectId(id), ...rest });
      return true;
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) return false;
      throw err;
    }
  },

  async get(userId, projectId, version) {
    const d = await collection().findOne({ userId, projectId, version });
    return d ? fromDoc(d) : null;
  },

  async list(userId, projectId) {
    const docs = await collection()
      .find({ userId, projectId }, { projection: { storyboard: 0 } })
      .sort({ version: -1 })
      .toArray();
    return docs.map((d) => fromDoc(d as Doc));
  },

  async remove(userId, id) {
    if (ObjectId.isValid(id)) await collection().deleteOne({ _id: new ObjectId(id), userId });
  },

  async deleteAllForUser(userId) {
    return (await collection().deleteMany({ userId })).deletedCount;
  },

  async deleteForProject(userId, projectId) {
    return (await collection().deleteMany({ userId, projectId })).deletedCount;
  },
};

// ── Memory (DB_DRIVER=memory) ────────────────────────────────────────────────

const g = globalThis as unknown as { __memoryStoryboards?: Map<string, StoryboardVersionRecord> };
const store = (g.__memoryStoryboards ??= new Map());
const key = (projectId: string, version: number) => `${projectId}:${version}`;

export const memoryStoryboards: StoryboardRepo = {
  newId: () => randomBytes(12).toString("hex"),

  async insert(record) {
    const k = key(record.projectId, record.version);
    if (store.has(k)) return false;
    store.set(k, structuredClone(record));
    return true;
  },

  async get(userId, projectId, version) {
    const r = store.get(key(projectId, version));
    return r && r.userId === userId ? structuredClone(r) : null;
  },

  async list(userId, projectId) {
    return [...store.values()]
      .filter((r) => r.userId === userId && r.projectId === projectId)
      .sort((a, b) => b.version - a.version)
      .map((r) => {
        const copy: Partial<StoryboardVersionRecord> = structuredClone(r);
        delete copy.storyboard;
        return copy as Omit<StoryboardVersionRecord, "storyboard">;
      });
  },

  async remove(userId, id) {
    for (const [k, r] of store) if (r.id === id && r.userId === userId) store.delete(k);
  },

  async deleteAllForUser(userId) {
    let n = 0;
    for (const [k, r] of store) if (r.userId === userId && store.delete(k)) n++;
    return n;
  },

  async deleteForProject(userId, projectId) {
    let n = 0;
    for (const [k, r] of store) if (r.userId === userId && r.projectId === projectId && store.delete(k)) n++;
    return n;
  },
};

export function resetMemoryStoryboards() {
  store.clear();
}

export function storyboardRepo(): StoryboardRepo {
  return dbDriver() === "memory" ? memoryStoryboards : mongoRepo;
}
