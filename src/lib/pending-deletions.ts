import "server-only";
import type { Collection } from "mongodb";
import { db } from "./db";
import { dbDriver } from "./env";

/**
 * Storage folders that must still be removed (e.g. after an account deletion whose file cleanup
 * failed). Written before the delete is tried, removed once it succeeds, and retried daily by the
 * purge job, so files never outlive their records.
 */
export interface PendingDeletions {
  add(prefix: string, at: Date): Promise<void>;
  list(limit: number): Promise<string[]>;
  done(prefix: string): Promise<void>;
}

type Doc = { _id: string; createdAt: Date };
const collection = (): Collection<Doc> => db().collection<Doc>("pending_file_deletions");

const mongoRepo: PendingDeletions = {
  async add(prefix, at) {
    await collection().updateOne({ _id: prefix }, { $setOnInsert: { createdAt: at } }, { upsert: true });
  },
  async list(limit) {
    return (await collection().find().sort({ createdAt: 1 }).limit(limit).toArray()).map((d) => d._id);
  },
  async done(prefix) {
    await collection().deleteOne({ _id: prefix });
  },
};

const g = globalThis as unknown as { __memoryPendingDeletions?: Map<string, Date> };
const store = (g.__memoryPendingDeletions ??= new Map());

export const memoryPendingDeletions: PendingDeletions = {
  async add(prefix, at) {
    if (!store.has(prefix)) store.set(prefix, at);
  },
  async list(limit) {
    return [...store.entries()].sort((a, b) => a[1].getTime() - b[1].getTime()).slice(0, limit).map(([k]) => k);
  },
  async done(prefix) {
    store.delete(prefix);
  },
};

export function resetMemoryPendingDeletions() {
  store.clear();
}

export function pendingDeletions(): PendingDeletions {
  return dbDriver() === "memory" ? memoryPendingDeletions : mongoRepo;
}
