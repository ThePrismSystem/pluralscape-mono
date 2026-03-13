import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** A PG database client wrapping postgres.js. */
export interface PgDatabaseClient {
  readonly dialect: "pg";
  readonly db: PostgresJsDatabase;
}

/** A SQLite database client wrapping better-sqlite3-multiple-ciphers. */
export interface SqliteDatabaseClient {
  readonly dialect: "sqlite";
  readonly db: BetterSQLite3Database;
}

/** Discriminated union of database clients, keyed on `dialect`. */
export type DatabaseClient = PgDatabaseClient | SqliteDatabaseClient;
