import { createDatabaseFromEnv } from "@pluralscape/db";

import { logger } from "./logger.js";

import type { Closeable } from "@pluralscape/db";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type DbState =
  | { status: "idle" }
  | { status: "pending"; promise: Promise<PostgresJsDatabase> }
  | { status: "ready"; db: PostgresJsDatabase; rawClient: Closeable };

let state: DbState = { status: "idle" };

async function initDb(): Promise<PostgresJsDatabase> {
  try {
    const client = await createDatabaseFromEnv(logger);
    if (client.dialect !== "pg") {
      throw new Error("API requires PostgreSQL — set DB_DIALECT=pg in environment.");
    }
    state = { status: "ready", db: client.db, rawClient: client.rawClient };
    return client.db;
  } finally {
    if (state.status === "pending") {
      state = { status: "idle" };
    }
  }
}

/**
 * Get the shared PG database client for the API.
 * Lazily creates the connection on first call.
 *
 * Not async — returns the raw Promise so that concurrent callers
 * receive the same promise identity (async would wrap it).
 */
export function getDb(): Promise<PostgresJsDatabase> {
  if (state.status === "ready") return Promise.resolve(state.db);
  if (state.status === "pending") return state.promise;
  const promise = initDb();
  state = { status: "pending", promise };
  return promise;
}

/** Returns the raw postgres.js client for shutdown draining. */
export function getRawClient(): Closeable | null {
  return state.status === "ready" ? state.rawClient : null;
}

/** Set the DB client directly (for testing). */
export function setDbForTesting(db: PostgresJsDatabase, rawClient?: Closeable): void {
  state = {
    status: "ready",
    db,
    rawClient: rawClient ?? { end: async () => {} },
  };
}

/** Reset the DB cache (for testing). */
export function _resetDbForTesting(): void {
  state = { status: "idle" };
}
