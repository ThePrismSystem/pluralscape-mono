import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PgliteDatabase } from "drizzle-orm/pglite";

/** A PG database client wrapping PGlite or postgres.js. */
export interface PgDatabaseClient {
  readonly dialect: "pg";
  readonly db: PgliteDatabase;
}

/** A SQLite database client wrapping better-sqlite3. */
export interface SqliteDatabaseClient {
  readonly dialect: "sqlite";
  readonly db: BetterSQLite3Database;
}

/** Discriminated union of database clients, keyed on `dialect`. */
export type DatabaseClient = PgDatabaseClient | SqliteDatabaseClient;
