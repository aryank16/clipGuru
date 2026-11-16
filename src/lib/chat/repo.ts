import "server-only";
import { randomBytes } from "node:crypto";
import { ObjectId, type Collection } from "mongodb";
import { db } from "../db";
import { dbDriver } from "../env";
import type { ChatMessageRecord, ChatStep } from "./types";

/** Every method is scoped to one user. */
export interface ChatRepo {
  insert(record: ChatMessageRecord): Promise<ChatMessageRecord>;
  /** Oldest first. */
  list(userId: string, projectId: string, step: ChatStep): Promise<ChatMessageRecord[]>;
  setStatus(userId: string, id: string, status: ChatMessageRecord["status"]): Promise<void>;
  /** User messages sent since `since`, across all projects (rate limit). */
  countUserMessagesSince(userId: string, since: Date): Promise<number>;
  deleteAllForUser(userId: string): Promise<number>;
  newId(): string;
}

// ── MongoDB ──────────────────────────────────────────────────────────────────

type Doc = Omit<ChatMessageRecord, "id"> & { _id: ObjectId };

let indexesReady: Promise<unknown> | null = null;

function collection(): Collection<Doc> {
  const c = db().collection<Doc>("chat_messages");
  indexesReady ??= c
    .createIndexes([
      { key: { projectId: 1, step: 1, createdAt: 1 } },
      { key: { userId: 1, role: 1, createdAt: -1 } },
    ])
    .catch((err) => {
      indexesReady = null;
      console.error("[chat] index creation failed", err);
    });
  return c;
}

function fromDoc({ _id, ...rest }: Doc): ChatMessageRecord {
  return { id: _id.toHexString(), ...rest };
}

const mongoRepo: ChatRepo = {
  newId: () => new ObjectId().toHexString(),

  async insert(record) {
    const { id, ...rest } = record;
    await collection().insertOne({ _id: new ObjectId(id), ...rest });
    return record;
  },

  async list(userId, projectId, step) {
    const docs = await collection().find({ userId, projectId, step }).sort({ createdAt: 1, _id: 1 }).toArray();
    return docs.map(fromDoc);
  },

  async setStatus(userId, id, status) {
    if (!ObjectId.isValid(id)) return;
    await collection().updateOne({ _id: new ObjectId(id), userId }, { $set: { status } });
  },

  async countUserMessagesSince(userId, since) {
    return collection().countDocuments({ userId, role: "user", createdAt: { $gte: since } });
  },

  async deleteAllForUser(userId) {
    return (await collection().deleteMany({ userId })).deletedCount;
  },
};

// ── Memory (DB_DRIVER=memory) ────────────────────────────────────────────────

const g = globalThis as unknown as { __memoryChat?: Map<string, ChatMessageRecord> };
const store = (g.__memoryChat ??= new Map());

export const memoryChat: ChatRepo = {
  newId: () => randomBytes(12).toString("hex"),

  async insert(record) {
    store.set(record.id, structuredClone(record));
    return structuredClone(record);
  },

  async list(userId, projectId, step) {
    return [...store.values()]
      .filter((r) => r.userId === userId && r.projectId === projectId && r.step === step)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1))
      .map((r) => structuredClone(r));
  },

  async setStatus(userId, id, status) {
    const r = store.get(id);
    if (r && r.userId === userId) r.status = status;
  },

  async countUserMessagesSince(userId, since) {
    let n = 0;
    for (const r of store.values()) if (r.userId === userId && r.role === "user" && r.createdAt >= since) n++;
    return n;
  },

  async deleteAllForUser(userId) {
    let n = 0;
    for (const [id, r] of store) if (r.userId === userId && store.delete(id)) n++;
    return n;
  },
};

export function resetMemoryChat() {
  store.clear();
}

export function chatRepo(): ChatRepo {
  return dbDriver() === "memory" ? memoryChat : mongoRepo;
}
