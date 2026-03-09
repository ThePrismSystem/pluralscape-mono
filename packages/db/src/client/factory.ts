import { getDialect } from "../dialect.js";

import type { DatabaseClient, PgDatabaseClient, SqliteDatabaseClient } from "./types.js";

/** Configuration for creating a PG database client. */
export interface PgConfig {
  readonly dialect: "pg";
  readonly connectionString: string;
}

/** Configuration for creating a SQLite database client. */
export interface SqliteConfig {
  readonly dialect: "sqlite";
  readonly filename: string;
}

/** Combined config union. */
export type DatabaseConfig = PgConfig | SqliteConfig;

/**
 * Creates a database client from explicit config.
 * Dynamically imports the appropriate driver to avoid pulling in both dialects.
 */
export async function createDatabase(config: PgConfig): Promise<PgDatabaseClient>;
export async function createDatabase(config: SqliteConfig): Promise<SqliteDatabaseClient>;
export async function createDatabase(config: DatabaseConfig): Promise<DatabaseClient>;
export async function createDatabase(config: DatabaseConfig): Promise<DatabaseClient> {
  switch (config.dialect) {
    case "pg": {
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");
      const client = await PGlite.create(config.connectionString);
      return { dialect: "pg", db: drizzle(client) };
    }
    case "sqlite": {
      const Database = (await import("better-sqlite3")).default;
      const { drizzle } = await import("drizzle-orm/better-sqlite3");
      const client = new Database(config.filename);
      client.pragma("journal_mode = WAL");
      return { dialect: "sqlite", db: drizzle(client) };
    }
  }
}

/**
 * Creates a database client from environment variables.
 * Reads DB_DIALECT and DATABASE_URL / DATABASE_PATH.
 */
export async function createDatabaseFromEnv(): Promise<DatabaseClient> {
  const dialect = getDialect();
  switch (dialect) {
    case "pg": {
      const connectionString = process.env["DATABASE_URL"];
      if (!connectionString) {
        throw new Error("DATABASE_URL environment variable is required for pg dialect");
      }
      return createDatabase({ dialect: "pg", connectionString });
    }
    case "sqlite": {
      const filename = process.env["DATABASE_PATH"] ?? "pluralscape.db";
      return createDatabase({ dialect: "sqlite", filename });
    }
  }
}
