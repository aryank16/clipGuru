import "server-only";
import { MongoServerError, type Collection } from "mongodb";
import { db } from "../db";
import { dbDriver } from "../env";
import type { InstagramAccountRecord } from "./types";

/** Linked Instagram accounts: one per person, and one person per Instagram account. */
export interface InstagramRepo {
  get(userId: string): Promise<InstagramAccountRecord | null>;
  /**
   * Links (or re-links) the person's account, replacing any earlier one. Returns false when that
   * Instagram account is already linked to someone else.
   */
  save(record: InstagramAccountRecord): Promise<boolean>;
  markReconnectNeeded(userId: string, at: Date): Promise<void>;
  delete(userId: string): Promise<boolean>;
  /** Stores a renewed token, only if the same Instagram account is still linked (a disconnect in between wins). */
  updateToken(userId: string, igUserId: string, tokenEnc: string, expiresAt: Date | null, at: Date): Promise<boolean>;
  /** Across all people: linked accounts not already waiting for a reconnect (the daily health check). */
  listConnected(limit: number): Promise<InstagramAccountRecord[]>;
}

// ── MongoDB ──────────────────────────────────────────────────────────────────

type Doc = InstagramAccountRecord & { _id: string };

let indexesReady: Promise<unknown> | null = null;

function collection(): Collection<Doc> {
  const c = db().collection<Doc>("instagram_accounts");
  indexesReady ??= c.createIndexes([{ key: { igUserId: 1 }, unique: true, name: "one_person_per_account" }]).catch((err) => {
    indexesReady = null;
    console.error("[instagram] index creation failed", err);
  });
  return c;
}

const fromDoc = ({ _id, ...rest }: Doc): InstagramAccountRecord => {
  void _id;
  return rest;
};

const mongoRepo: InstagramRepo = {
  async get(userId) {
    const d = await collection().findOne({ _id: userId });
    return d ? fromDoc(d) : null;
  },

  async save(record) {
    const c = collection();
    // The one-person-per-account rule must exist before a write, or two people could share one.
    if (!(await indexesReady)) {
      indexesReady = null;
      throw new Error("instagram_accounts unique index is missing");
    }
    try {
      await c.replaceOne({ _id: record.userId }, record, { upsert: true });
      return true;
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) return false;
      throw err;
    }
  },

  async markReconnectNeeded(userId, at) {
    await collection().updateOne({ _id: userId }, { $set: { reconnectNeeded: true, updatedAt: at } });
  },

  async delete(userId) {
    return (await collection().deleteOne({ _id: userId })).deletedCount > 0;
  },

  async updateToken(userId, igUserId, tokenEnc, expiresAt, at) {
    const r = await collection().updateOne({ _id: userId, igUserId }, { $set: { tokenEnc, tokenExpiresAt: expiresAt, updatedAt: at } });
    return r.matchedCount === 1;
  },

  async listConnected(limit) {
    return (await collection().find({ reconnectNeeded: { $ne: true } }).limit(limit).toArray()).map(fromDoc);
  },
};

// ── Memory (DB_DRIVER=memory) ────────────────────────────────────────────────

const g = globalThis as unknown as { __memoryInstagram?: Map<string, InstagramAccountRecord> };
const store = (g.__memoryInstagram ??= new Map());

export const memoryInstagram: InstagramRepo = {
  async get(userId) {
    const r = store.get(userId);
    return r ? structuredClone(r) : null;
  },
  async save(record) {
    for (const r of store.values()) if (r.igUserId === record.igUserId && r.userId !== record.userId) return false;
    store.set(record.userId, structuredClone(record));
    return true;
  },
  async markReconnectNeeded(userId, at) {
    const r = store.get(userId);
    if (r) Object.assign(r, { reconnectNeeded: true, updatedAt: at });
  },
  async delete(userId) {
    return store.delete(userId);
  },
  async updateToken(userId, igUserId, tokenEnc, expiresAt, at) {
    const r = store.get(userId);
    if (!r || r.igUserId !== igUserId) return false;
    Object.assign(r, { tokenEnc, tokenExpiresAt: expiresAt, updatedAt: at });
    return true;
  },
  async listConnected(limit) {
    return [...store.values()].filter((r) => !r.reconnectNeeded).slice(0, limit).map((r) => structuredClone(r));
  },
};

export function resetMemoryInstagram() {
  store.clear();
}

export function instagramRepo(): InstagramRepo {
  return dbDriver() === "memory" ? memoryInstagram : mongoRepo;
}
