import "server-only";
import { randomBytes } from "node:crypto";
import { MongoServerError, ObjectId, type Collection, type Filter } from "mongodb";
import { db } from "../db";
import { dbDriver } from "../env";
import { ACTIVE_POST_STATUSES, type PostRecord, type PostStatus } from "./types";

export type PostPatch = Partial<Omit<PostRecord, "id" | "userId" | "projectId" | "createdAt">>;
export type InsertResult = { ok: true } | { ok: false; reason: "active" | "idempotent" };

/** Posts (Database Design → posts). Every read by the person is scoped to them. */
export interface PostsRepo {
  newId(): string;
  /** Fails when the video already has a post waiting or sending, or the idempotency key was used. */
  insert(record: PostRecord): Promise<InsertResult>;
  get(userId: string, id: string): Promise<PostRecord | null>;
  /** For the background job, which only has the id. */
  byId(id: string): Promise<PostRecord | null>;
  byIdempotencyKey(userId: string, key: string): Promise<PostRecord | null>;
  /** Applies `patch` when the status is one of `from` (any when omitted). Null when it moved on first. */
  update(id: string, patch: PostPatch, from?: PostStatus[]): Promise<PostRecord | null>;
  latestForProject(userId: string, projectId: string): Promise<PostRecord | null>;
  activeForProject(userId: string, projectId: string): Promise<PostRecord | null>;
  /** Whether this render has gone out already. */
  postedForRender(userId: string, renderId: string): Promise<PostRecord | null>;
  /** Posts in [from, to) by time, optionally of some statuses (GET /api/posts). */
  list(userId: string, opts: { from: Date; to: Date; statuses?: PostStatus[] }): Promise<PostRecord[]>;
  /** Moves every scheduled post to held (Instagram disconnected). Returns the videos they belong to. */
  holdScheduled(userId: string, at: Date): Promise<string[]>;
  deleteAllForUser(userId: string): Promise<number>;
}

const isActive = (s: PostStatus) => ACTIVE_POST_STATUSES.includes(s);

// ── MongoDB ──────────────────────────────────────────────────────────────────

/** `active` mirrors scheduled/publishing so a partial unique index allows one per video. */
type Doc = Omit<PostRecord, "id"> & { _id: ObjectId; active: boolean };

let indexesReady: Promise<unknown> | null = null;

function collection(): Collection<Doc> {
  const c = db().collection<Doc>("posts");
  indexesReady ??= c
    .createIndexes([
      { key: { projectId: 1 }, unique: true, partialFilterExpression: { active: true }, name: "one_active_per_project" },
      {
        key: { userId: 1, idempotencyKey: 1 },
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: "string" } },
        name: "idempotency",
      },
      { key: { userId: 1, projectId: 1, createdAt: -1 } },
      { key: { userId: 1, scheduledAt: 1 } },
      { key: { userId: 1, renderId: 1, status: 1 } },
    ])
    .catch((err) => {
      indexesReady = null;
      console.error("[posts] index creation failed", err);
    });
  return c;
}

function fromDoc(d: Doc): PostRecord {
  const { _id, ...rest } = d;
  delete (rest as Partial<Doc>).active;
  return { id: _id.toHexString(), ...rest };
}
const oid = (id: string) => (/^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null);

const mongoRepo: PostsRepo = {
  newId: () => new ObjectId().toHexString(),

  async insert({ id, ...rest }) {
    const c = collection();
    // The one-per-video and idempotency rules must exist before any insert.
    if (!(await indexesReady)) {
      indexesReady = null;
      throw new Error("posts unique indexes are missing");
    }
    try {
      await c.insertOne({ _id: new ObjectId(id), ...rest, active: isActive(rest.status) });
      return { ok: true };
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) {
        const idem = JSON.stringify(err.keyPattern ?? {}).includes("idempotencyKey");
        return { ok: false, reason: idem ? "idempotent" : "active" };
      }
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

  async byIdempotencyKey(userId, key) {
    const d = await collection().findOne({ userId, idempotencyKey: key });
    return d ? fromDoc(d) : null;
  },

  async update(id, patch, from) {
    const _id = oid(id);
    if (!_id) return null;
    const set: Partial<Doc> = { ...patch };
    if (patch.status) set.active = isActive(patch.status);
    try {
      const d = await collection().findOneAndUpdate(
        { _id, ...(from ? { status: { $in: from } } : {}) },
        { $set: set },
        { returnDocument: "after" },
      );
      return d ? fromDoc(d) : null;
    } catch (err) {
      // Bringing a post back while another one of the same video is waiting.
      if (err instanceof MongoServerError && err.code === 11000) return null;
      throw err;
    }
  },

  async latestForProject(userId, projectId) {
    const d = await collection().find({ userId, projectId }).sort({ createdAt: -1 }).limit(1).next();
    return d ? fromDoc(d) : null;
  },

  async activeForProject(userId, projectId) {
    const d = await collection().findOne({ userId, projectId, active: true });
    return d ? fromDoc(d) : null;
  },

  async postedForRender(userId, renderId) {
    const d = await collection().findOne({ userId, renderId, status: "posted" });
    return d ? fromDoc(d) : null;
  },

  async list(userId, { from, to, statuses }) {
    const q: Filter<Doc> = { userId, scheduledAt: { $gte: from, $lt: to } };
    if (statuses?.length) q.status = { $in: statuses };
    return (await collection().find(q).sort({ scheduledAt: 1, createdAt: 1 }).limit(500).toArray()).map(fromDoc);
  },

  async holdScheduled(userId, at) {
    const c = collection();
    const ids = await c.distinct("projectId", { userId, status: "scheduled" });
    await c.updateMany(
      { userId, status: "scheduled" },
      {
        $set: {
          status: "held",
          active: false,
          updatedAt: at,
          error: { code: "IG_RECONNECT", message: "Instagram was disconnected. Connect it again, then pick a new time." },
        },
      },
    );
    return ids;
  },

  async deleteAllForUser(userId) {
    return (await collection().deleteMany({ userId })).deletedCount;
  },
};

// ── Memory (DB_DRIVER=memory) ────────────────────────────────────────────────

const g = globalThis as unknown as { __memoryPosts?: Map<string, PostRecord> };
const store = (g.__memoryPosts ??= new Map());
const copy = (r: PostRecord): PostRecord => structuredClone(r);
const all = () => [...store.values()];

export const memoryPosts: PostsRepo = {
  newId: () => randomBytes(12).toString("hex"),

  async insert(record) {
    if (record.idempotencyKey && all().some((p) => p.userId === record.userId && p.idempotencyKey === record.idempotencyKey)) {
      return { ok: false, reason: "idempotent" };
    }
    if (isActive(record.status) && all().some((p) => p.projectId === record.projectId && isActive(p.status))) {
      return { ok: false, reason: "active" };
    }
    store.set(record.id, copy(record));
    return { ok: true };
  },

  async get(userId, id) {
    const r = store.get(id);
    return r && r.userId === userId ? copy(r) : null;
  },

  async byId(id) {
    const r = store.get(id);
    return r ? copy(r) : null;
  },

  async byIdempotencyKey(userId, key) {
    const r = all().find((p) => p.userId === userId && p.idempotencyKey === key);
    return r ? copy(r) : null;
  },

  async update(id, patch, from) {
    const r = store.get(id);
    if (!r || (from && !from.includes(r.status))) return null;
    if (patch.status && isActive(patch.status) && !isActive(r.status)) {
      if (all().some((p) => p.id !== id && p.projectId === r.projectId && isActive(p.status))) return null;
    }
    Object.assign(r, structuredClone(patch));
    return copy(r);
  },

  async latestForProject(userId, projectId) {
    const r = all()
      .filter((p) => p.userId === userId && p.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return r ? copy(r) : null;
  },

  async activeForProject(userId, projectId) {
    const r = all().find((p) => p.userId === userId && p.projectId === projectId && isActive(p.status));
    return r ? copy(r) : null;
  },

  async postedForRender(userId, renderId) {
    const r = all().find((p) => p.userId === userId && p.renderId === renderId && p.status === "posted");
    return r ? copy(r) : null;
  },

  async list(userId, { from, to, statuses }) {
    return all()
      .filter(
        (p) =>
          p.userId === userId &&
          p.scheduledAt >= from &&
          p.scheduledAt < to &&
          (!statuses?.length || statuses.includes(p.status)),
      )
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime())
      .map(copy);
  },

  async holdScheduled(userId, at) {
    const ids: string[] = [];
    for (const p of store.values()) {
      if (p.userId === userId && p.status === "scheduled") {
        Object.assign(p, {
          status: "held",
          updatedAt: at,
          error: { code: "IG_RECONNECT", message: "Instagram was disconnected. Connect it again, then pick a new time." },
        });
        ids.push(p.projectId);
      }
    }
    return ids;
  },

  async deleteAllForUser(userId) {
    let n = 0;
    for (const [id, p] of store) if (p.userId === userId && store.delete(id)) n++;
    return n;
  },
};

export function resetMemoryPosts() {
  store.clear();
}

export function postsRepo(): PostsRepo {
  return dbDriver() === "memory" ? memoryPosts : mongoRepo;
}
