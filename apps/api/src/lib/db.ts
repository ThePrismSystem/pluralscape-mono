import { createDatabaseFromEnv } from "@pluralscape/db";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

let cachedDb: PostgresJsDatabase | null = null;

/**
 * Get the shared PG database client for the API.
 * Lazily creates the connection on first call.
 */
export async function getDb(): Promise<PostgresJsDatabase> {
  if (cachedDb) return cachedDb;
  const client = await createDatabaseFromEnv();
  if (client.dialect !== "pg") {
    throw new Error("API requires PostgreSQL — set DB_DIALECT=pg in environment.");
  }
  cachedDb = client.db;
  return cachedDb;
}

/** Set the DB client directly (for testing). */
export function setDbForTesting(db: PostgresJsDatabase): void {
  cachedDb = db;
}

/** Reset the DB cache (for testing). */
export function _resetDbForTesting(): void {
  cachedDb = null;
}
