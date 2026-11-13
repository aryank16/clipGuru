import { randomBytes } from "node:crypto";
import type { ProjectsRepo } from "./repo";
import { countsFrom, cursorFor, readCursor } from "./shared";
import { FILTER_STATUSES, type ProjectRecord } from "./types";

/** In-process projects store for DB_DRIVER=memory (tests, offline dev). Mirrors the Mongo repo. */
const g = globalThis as unknown as { __memoryProjects?: Map<string, ProjectRecord> };
const store = (g.__memoryProjects ??= new Map());

const clone = (r: ProjectRecord): ProjectRecord => structuredClone(r);

function newer(a: ProjectRecord, b: ProjectRecord): number {
  const d = b.updatedAt.getTime() - a.updatedAt.getTime();
  return d !== 0 ? d : b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
}

export const memoryProjects: ProjectsRepo = {
  newId: () => randomBytes(12).toString("hex"),

  async list(userId, { filter, q, limit, cursor }) {
    const statuses = FILTER_STATUSES[filter];
    const needle = q?.toLowerCase();
    const c = readCursor(cursor);
    const rows = [...store.values()]
      .filter((r) => r.userId === userId && !r.deletedAt)
      .filter((r) => !statuses || statuses.includes(r.status))
      .filter((r) => !needle || r.title.toLowerCase().includes(needle))
      .filter((r) => {
        if (!c) return true;
        const u = Date.parse(c.u);
        const t = r.updatedAt.getTime();
        return t < u || (t === u && r.id < c.i);
      })
      .sort(newer);
    const items = rows.slice(0, limit).map(clone);
    return { items, nextCursor: rows.length > limit ? cursorFor(items[items.length - 1]) : null };
  },

  async counts(userId) {
    const byStatus = new Map<string, number>();
    for (const r of store.values()) {
      if (r.userId !== userId || r.deletedAt) continue;
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    }
    return countsFrom([...byStatus]);
  },

  async insert(record) {
    store.set(record.id, clone(record));
    return clone(record);
  },

  async get(userId, id) {
    const r = store.get(id);
    return r && r.userId === userId && !r.deletedAt ? clone(r) : null;
  },

  async getDeleted(userId, id) {
    const r = store.get(id);
    return r && r.userId === userId && r.deletedAt ? clone(r) : null;
  },

  async update(userId, id, rev, patch, now) {
    const r = store.get(id);
    if (!r || r.userId !== userId || r.deletedAt || r.rev !== rev) return null;
    Object.assign(r, patch, { updatedAt: now, rev: r.rev + 1 });
    return clone(r);
  },

  async setDeleted(userId, id, deletedAt, now) {
    const r = store.get(id);
    if (!r || r.userId !== userId || Boolean(r.deletedAt) === Boolean(deletedAt)) return null;
    r.deletedAt = deletedAt;
    if (!deletedAt) r.updatedAt = now;
    r.rev += 1;
    return clone(r);
  },
};

/** Test helper. */
export function resetMemoryProjects() {
  store.clear();
}
