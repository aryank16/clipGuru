import "server-only";
import { ObjectId, type Collection, type Filter } from "mongodb";
import type { Page } from "../api/pagination";
import { db } from "../db";
import { dbDriver } from "../env";
import { memoryProjects } from "./memory";
import { countsFrom, cursorFor, escapeRegex, readCursor } from "./shared";
import { FILTER_STATUSES, type FilterCounts, type ProjectFilter, type ProjectRecord } from "./types";

export type ListOptions = { filter: ProjectFilter; q?: string; limit: number; cursor?: string };
export type Patch = Partial<Pick<ProjectRecord, "title" | "brief" | "voiceId">>;

/** Every method is scoped to one user; another user's project behaves as missing. */
export interface ProjectsRepo {
  list(userId: string, opts: ListOptions): Promise<Page<ProjectRecord>>;
  counts(userId: string): Promise<FilterCounts>;
  insert(record: ProjectRecord): Promise<ProjectRecord>;
  /** Live (not deleted) project, or null. */
  get(userId: string, id: string): Promise<ProjectRecord | null>;
  /** Deleted project, or null. */
  getDeleted(userId: string, id: string): Promise<ProjectRecord | null>;
  /** Apply `patch` if the stored rev still equals `rev`; returns the updated record or null. */
  update(userId: string, id: string, rev: number, patch: Patch, now: Date): Promise<ProjectRecord | null>;
  setDeleted(userId: string, id: string, deletedAt: Date | null, now: Date): Promise<ProjectRecord | null>;
  newId(): string;
}

// ── MongoDB ──────────────────────────────────────────────────────────────────

type Doc = Omit<ProjectRecord, "id"> & { _id: ObjectId };

function fromDoc(d: Doc): ProjectRecord {
  const { _id, ...rest } = d;
  return { id: _id.toHexString(), ...rest };
}

function oid(id: string): ObjectId | null {
  return ObjectId.isValid(id) && /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null;
}

let indexesReady: Promise<unknown> | null = null;

function collection(): Collection<Doc> {
  const c = db().collection<Doc>("projects");
  indexesReady ??= c
    .createIndexes([
      { key: { userId: 1, deletedAt: 1, status: 1, updatedAt: -1 } },
      { key: { userId: 1, title: "text" } },
      { key: { deletedAt: 1 }, partialFilterExpression: { deletedAt: { $type: "date" } } },
      { key: { hasChat: 1, createdAt: 1 }, partialFilterExpression: { hasChat: false } },
    ])
    .catch((err) => {
      indexesReady = null;
      console.error("[projects] index creation failed", err);
    });
  return c;
}

const mongoRepo: ProjectsRepo = {
  newId: () => new ObjectId().toHexString(),

  async list(userId, { filter, q, limit, cursor }) {
    const where: Filter<Doc> = { userId, deletedAt: null };
    const statuses = FILTER_STATUSES[filter];
    if (statuses) where.status = { $in: statuses };
    if (q) where.title = { $regex: escapeRegex(q), $options: "i" };
    const c = readCursor(cursor);
    if (c) {
      const u = new Date(c.u);
      const i = oid(c.i) ?? new ObjectId("000000000000000000000000");
      where.$or = [{ updatedAt: { $lt: u } }, { updatedAt: u, _id: { $lt: i } }];
    }
    const docs = await collection().find(where).sort({ updatedAt: -1, _id: -1 }).limit(limit + 1).toArray();
    const items = docs.slice(0, limit).map(fromDoc);
    return { items, nextCursor: docs.length > limit ? cursorFor(items[items.length - 1]) : null };
  },

  async counts(userId) {
    const rows = await collection()
      .aggregate<{ _id: string; n: number }>([
        { $match: { userId, deletedAt: null } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ])
      .toArray();
    return countsFrom(rows.map((r) => [r._id, r.n]));
  },

  async insert(record) {
    const { id, ...rest } = record;
    await collection().insertOne({ _id: new ObjectId(id), ...rest });
    return record;
  },

  async get(userId, id) {
    const _id = oid(id);
    if (!_id) return null;
    const d = await collection().findOne({ _id, userId, deletedAt: null });
    return d ? fromDoc(d) : null;
  },

  async getDeleted(userId, id) {
    const _id = oid(id);
    if (!_id) return null;
    const d = await collection().findOne({ _id, userId, deletedAt: { $ne: null } });
    return d ? fromDoc(d) : null;
  },

  async update(userId, id, rev, patch, now) {
    const _id = oid(id);
    if (!_id) return null;
    const d = await collection().findOneAndUpdate(
      { _id, userId, deletedAt: null, rev },
      { $set: { ...patch, updatedAt: now }, $inc: { rev: 1 } },
      { returnDocument: "after" },
    );
    return d ? fromDoc(d) : null;
  },

  async setDeleted(userId, id, deletedAt, now) {
    const _id = oid(id);
    if (!_id) return null;
    const d = await collection().findOneAndUpdate(
      { _id, userId, deletedAt: deletedAt ? null : { $ne: null } },
      // Restoring bumps updatedAt so the video comes back at the top of the list.
      { $set: deletedAt ? { deletedAt } : { deletedAt: null, updatedAt: now }, $inc: { rev: 1 } },
      { returnDocument: "after" },
    );
    return d ? fromDoc(d) : null;
  },
};

export function projectsRepo(): ProjectsRepo {
  return dbDriver() === "memory" ? memoryProjects : mongoRepo;
}
