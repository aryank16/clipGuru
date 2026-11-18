import "server-only";
import { randomBytes } from "node:crypto";
import { MongoServerError, ObjectId, type Collection } from "mongodb";
import { db } from "../db";
import { dbDriver } from "../env";
import { ACTIVE_STATUSES, type RenderRecord, type RenderStatus } from "./types";

export type RenderPatch = Partial<Omit<RenderRecord, "id" | "userId" | "projectId" | "createdAt">>;

/** Renders (Database Design → renders). */
export interface RenderRepo {
  newId(): string;
  /** Returns false when the project already has a render queued or running. */
  insert(record: RenderRecord): Promise<boolean>;
  get(userId: string, id: string): Promise<RenderRecord | null>;
  /** For the background job, which only has the id. */
  byId(id: string): Promise<RenderRecord | null>;
  /**
   * Applies `patch` when the render's status is one of `from` (any status when omitted).
   * Returns the updated record, or null when another step got there first.
   */
  update(id: string, patch: RenderPatch, from?: RenderStatus[]): Promise<RenderRecord | null>;
  latestForProject(userId: string, projectId: string): Promise<RenderRecord | null>;
  activeForProject(userId: string, projectId: string): Promise<RenderRecord | null>;
  countActive(userId: string): Promise<number>;
  listActive(userId: string): Promise<RenderRecord[]>;
  countSince(userId: string, since: Date): Promise<number>;
  deleteAllForUser(userId: string): Promise<number>;
}

const isActive = (s: RenderStatus) => ACTIVE_STATUSES.includes(s);

// ── MongoDB ──────────────────────────────────────────────────────────────────

/** `active` mirrors queued/running so a partial unique index allows one per project. */
type Doc = Omit<RenderRecord, "id"> & { _id: ObjectId; active: boolean };

let indexesReady: Promise<unknown> | null = null;

function collection(): Collection<Doc> {
  const c = db().collection<Doc>("renders");
  indexesReady ??= c
    .createIndexes([
      { key: { projectId: 1 }, unique: true, partialFilterExpression: { active: true }, name: "one_active_per_project" },
      { key: { userId: 1, projectId: 1, createdAt: -1 } },
      { key: { userId: 1, createdAt: -1 } },
    ])
    .catch((err) => {
      indexesReady = null;
      console.error("[render] index creation failed", err);
    });
  return c;
}

function fromDoc(d: Doc): RenderRecord {
  const { _id, ...rest } = d;
  delete (rest as Partial<Doc>).active;
  return { id: _id.toHexString(), ...rest };
}
const oid = (id: string) => (/^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null);

const mongoRepo: RenderRepo = {
  newId: () => new ObjectId().toHexString(),

  async insert({ id, ...rest }) {
    const c = collection();
    // The one-per-project rule must exist before any insert, or two renders could start at once.
    if (!(await indexesReady)) {
      indexesReady = null;
      throw new Error("renders unique index is missing");
    }
    try {
      await c.insertOne({ _id: new ObjectId(id), ...rest, active: isActive(rest.status) });
      return true;
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) return false;
      throw err;
    }
  },

  async get(userId, id) {
    const _id = oid(id);
    const d = _id ? await collection().findOne({ _id, userId }) : null;
    return d ? fromDoc(d) : null;
  },

  async byId(id) {
    const _id = oid(id);
    const d = _id ? await collection().findOne({ _id }) : null;
    return d ? fromDoc(d) : null;
  },

  async update(id, patch, from) {
    const _id = oid(id);
    if (!_id) return null;
    const set: Partial<Doc> = { ...patch };
    if (patch.status) set.active = isActive(patch.status);
    const d = await collection().findOneAndUpdate(
      { _id, ...(from ? { status: { $in: from } } : {}) },
      { $set: set },
      { returnDocument: "after" },
    );
    return d ? fromDoc(d) : null;
  },

  async latestForProject(userId, projectId) {
    const d = await collection().find({ userId, projectId }).sort({ createdAt: -1 }).limit(1).next();
    return d ? fromDoc(d) : null;
  },

  async activeForProject(userId, projectId) {
    const d = await collection().findOne({ userId, projectId, active: true });
    return d ? fromDoc(d) : null;
  },

  async countActive(userId) {
    return collection().countDocuments({ userId, active: true });
  },

  async listActive(userId) {
    return (await collection().find({ userId, active: true }).limit(50).toArray()).map(fromDoc);
  },

  async countSince(userId, since) {
    return collection().countDocuments({ userId, createdAt: { $gte: since } });
  },

  async deleteAllForUser(userId) {
    return (await collection().deleteMany({ userId })).deletedCount;
  },
};

// ── Memory (DB_DRIVER=memory) ────────────────────────────────────────────────

const g = globalThis as unknown as { __memoryRenders?: Map<string, RenderRecord> };
const store = (g.__memoryRenders ??= new Map());
const copy = (r: RenderRecord): RenderRecord => structuredClone(r);
const newest = (rs: RenderRecord[]) => rs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;

export const memoryRenders: RenderRepo = {
  newId: () => randomBytes(12).toString("hex"),

  async insert(record) {
    if (isActive(record.status) && [...store.values()].some((r) => r.projectId === record.projectId && isActive(r.status))) {
      return false;
    }
    store.set(record.id, copy(record));
    return true;
  },

  async get(userId, id) {
    const r = store.get(id);
    return r && r.userId === userId ? copy(r) : null;
  },

  async byId(id) {
    const r = store.get(id);
    return r ? copy(r) : null;
  },

  async update(id, patch, from) {
    const r = store.get(id);
    if (!r || (from && !from.includes(r.status))) return null;
    Object.assign(r, structuredClone(patch));
    return copy(r);
  },

  async latestForProject(userId, projectId) {
    const r = newest([...store.values()].filter((x) => x.userId === userId && x.projectId === projectId));
    return r ? copy(r) : null;
  },

  async activeForProject(userId, projectId) {
    const r = [...store.values()].find((x) => x.userId === userId && x.projectId === projectId && isActive(x.status));
    return r ? copy(r) : null;
  },

  async countActive(userId) {
    return [...store.values()].filter((r) => r.userId === userId && isActive(r.status)).length;
  },

  async listActive(userId) {
    return [...store.values()].filter((r) => r.userId === userId && isActive(r.status)).map(copy);
  },

  async countSince(userId, since) {
    return [...store.values()].filter((r) => r.userId === userId && r.createdAt >= since).length;
  },

  async deleteAllForUser(userId) {
    let n = 0;
    for (const [id, r] of store) if (r.userId === userId && store.delete(id)) n++;
    return n;
  },
};

export function resetMemoryRenders() {
  store.clear();
}

export function renderRepo(): RenderRepo {
  return dbDriver() === "memory" ? memoryRenders : mongoRepo;
}
