import { MongoClient, type Db } from "mongodb";
import { env } from "./env";

/**
 * One MongoClient per server process (cached on globalThis so dev hot reloads
 * don't open a new pool each time). The database name comes from the URI path
 * (`.../clipguru`), defaulting to `clipguru`.
 */
const globalForMongo = globalThis as unknown as { __mongoClient?: MongoClient };

export function mongoClient(): MongoClient {
  const uri = env().MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  if (!globalForMongo.__mongoClient) {
    globalForMongo.__mongoClient = new MongoClient(uri, { appName: "clipguru" });
  }
  return globalForMongo.__mongoClient;
}

export function db(): Db {
  const client = mongoClient();
  // The driver reports "test" when the URI has no database path.
  const name = client.options.dbName;
  return client.db(name && name !== "test" ? name : "clipguru");
}
