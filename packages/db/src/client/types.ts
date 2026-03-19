import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Minimal interface for closing a connection pool.
 * Avoids importing postgres.js types into shared code that SQLite consumers also use.
 */
export interface Closeable {
  end(options?: { timeout?: number }): Promise<void>;
}

/** A PG database client wrapping postgres.js. */
export interface PgDatabaseClient {
  readonly dialect: "pg";
  readonly db: PostgresJsDatabase;
  readonly rawClient: Closeable;
}

/** A SQLite database client wrapping better-sqlite3-multiple-ciphers. */
export interface SqliteDatabaseClient {
  readonly dialect: "sqlite";
  readonly db: BetterSQLite3Database;
}

/** Discriminated union of database clients, keyed on `dialect`. */
export type DatabaseClient = PgDatabaseClient | SqliteDatabaseClient;
