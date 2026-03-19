import { createDatabaseFromEnv } from "@pluralscape/db";

import type { Closeable } from "@pluralscape/db";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

let cachedDb: PostgresJsDatabase | null = null;
let cachedRawClient: Closeable | null = null;
let pendingInit: Promise<PostgresJsDatabase> | null = null;

async function initDb(): Promise<PostgresJsDatabase> {
  try {
    const client = await createDatabaseFromEnv();
    if (client.dialect !== "pg") {
      throw new Error("API requires PostgreSQL — set DB_DIALECT=pg in environment.");
    }
    cachedDb = client.db;
    cachedRawClient = client.rawClient;
    return cachedDb;
  } catch (err) {
    pendingInit = null;
    throw err;
  }
}

/**
 * Get the shared PG database client for the API.
 * Lazily creates the connection on first call.
 */
export async function getDb(): Promise<PostgresJsDatabase> {
  if (cachedDb) return cachedDb;
  if (pendingInit) return pendingInit;
  pendingInit = initDb();
  return pendingInit;
}

/** Returns the raw postgres.js client for shutdown draining. */
export function getRawClient(): Closeable | null {
  return cachedRawClient;
}

/** Set the DB client directly (for testing). */
export function setDbForTesting(db: PostgresJsDatabase, rawClient?: Closeable): void {
  cachedDb = db;
  if (rawClient !== undefined) cachedRawClient = rawClient;
}

/** Reset the DB cache (for testing). */
export function _resetDbForTesting(): void {
  cachedDb = null;
  cachedRawClient = null;
  pendingInit = null;
}
