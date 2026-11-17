import "server-only";
import { randomBytes } from "node:crypto";
import { MongoServerError, ObjectId, type Collection } from "mongodb";
import { db } from "../db";
import { dbDriver } from "../env";
import type { VoiceoverRecord } from "./types";

/** Voiceovers (Database Design → voiceovers). Every method is scoped to one user. */
export interface VoiceoverRepo {
  newId(): string;
  /** Returns false when this project already has a voiceover with that hash (two requests raced). */
  insert(record: VoiceoverRecord): Promise<boolean>;
  findByHash(userId: string, projectId: string, hash: string): Promise<VoiceoverRecord | null>;
  get(userId: string, id: string): Promise<VoiceoverRecord | null>;
  countSince(userId: string, since: Date): Promise<number>;
  deleteAllForUser(userId: string): Promise<number>;
}

// ── MongoDB ──────────────────────────────────────────────────────────────────

type Doc = Omit<VoiceoverRecord, "id"> & { _id: ObjectId };

let indexesReady: Promise<unknown> | null = null;

function collection(): Collection<Doc> {
  const c = db().collection<Doc>("voiceovers");
  indexesReady ??= c
    .createIndexes([
      { key: { projectId: 1, hash: 1 }, unique: true },
      { key: { userId: 1, createdAt: -1 } },
    ])
    .catch((err) => {
      indexesReady = null;
      console.error("[voiceover] index creation failed", err);
    });
  return c;
}

const fromDoc = ({ _id, ...rest }: Doc): VoiceoverRecord => ({ id: _id.toHexString(), ...rest });

const mongoRepo: VoiceoverRepo = {
  newId: () => new ObjectId().toHexString(),

  async insert({ id, ...rest }) {
    try {
      await collection().insertOne({ _id: new ObjectId(id), ...rest });
      return true;
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) return false;
      throw err;
    }
  },

  async findByHash(userId, projectId, hash) {
    const d = await collection().findOne({ userId, projectId, hash });
    return d ? fromDoc(d) : null;
  },

  async get(userId, id) {
    if (!ObjectId.isValid(id)) return null;
    const d = await collection().findOne({ _id: new ObjectId(id), userId });
    return d ? fromDoc(d) : null;
  },

  async countSince(userId, since) {
    return collection().countDocuments({ userId, createdAt: { $gte: since } });
  },

  async deleteAllForUser(userId) {
    return (await collection().deleteMany({ userId })).deletedCount;
  },
};

// ── Memory (DB_DRIVER=memory) ────────────────────────────────────────────────

const g = globalThis as unknown as { __memoryVoiceovers?: Map<string, VoiceoverRecord> };
const store = (g.__memoryVoiceovers ??= new Map());

export const memoryVoiceovers: VoiceoverRepo = {
  newId: () => randomBytes(12).toString("hex"),

  async insert(record) {
    for (const r of store.values()) if (r.projectId === record.projectId && r.hash === record.hash) return false;
    store.set(record.id, structuredClone(record));
    return true;
  },

  async findByHash(userId, projectId, hash) {
    for (const r of store.values()) {
      if (r.userId === userId && r.projectId === projectId && r.hash === hash) return structuredClone(r);
    }
    return null;
  },

  async get(userId, id) {
    const r = store.get(id);
    return r && r.userId === userId ? structuredClone(r) : null;
  },

  async countSince(userId, since) {
    return [...store.values()].filter((r) => r.userId === userId && r.createdAt >= since).length;
  },

  async deleteAllForUser(userId) {
    let n = 0;
    for (const [k, r] of store) if (r.userId === userId && store.delete(k)) n++;
    return n;
  },
};

export function resetMemoryVoiceovers() {
  store.clear();
}

export function voiceoverRepo(): VoiceoverRepo {
  return dbDriver() === "memory" ? memoryVoiceovers : mongoRepo;
}
