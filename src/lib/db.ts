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
    const client = new MongoClient(uri, { appName: "clipguru" });
    keepConnected(client);
    globalForMongo.__mongoClient = client;
  }
  return globalForMongo.__mongoClient;
}

/**
 * The driver closes the client for good when its first connection fails (e.g. Atlas is briefly
 * unreachable), and every later query then throws "Topology is closed" until the server restarts.
 * Connect up front so the real cause is logged, and when the client closes on its own, connect
 * it again with a growing pause (1s, 2s, 4s … up to 30s).
 */
function keepConnected(client: MongoClient) {
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    timer = null;
    client
      .connect()
      .then(() => {
        if (attempt > 0) console.info(`[db] connected again after ${attempt} retr${attempt === 1 ? "y" : "ies"}`);
        attempt = 0;
      })
      .catch((error: unknown) => {
        console.error("[db] could not connect to MongoDB:", describe(error));
      });
  };

  client.on("topologyClosed", () => {
    if (timer) return;
    const delay = Math.min(1000 * 2 ** attempt, 30_000);
    attempt += 1;
    timer = setTimeout(connect, delay);
    // Don't keep a process alive just to reconnect.
    timer.unref?.();
  });

  connect();
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const reason = (error as { reason?: { servers?: Map<string, { error?: unknown }> } }).reason;
  const causes = reason?.servers
    ? [...reason.servers.values()].map((s) => (s.error instanceof Error ? s.error.message : null)).filter(Boolean)
    : [];
  const unique = [...new Set(causes)];
  return unique.length ? `${error.message} (${unique.join("; ")})` : error.message;
}

export function db(): Db {
  const client = mongoClient();
  // The driver reports "test" when the URI has no database path.
  const name = client.options.dbName;
  return client.db(name && name !== "test" ? name : "clipguru");
}
