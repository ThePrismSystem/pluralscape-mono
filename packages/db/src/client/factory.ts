import { getDialect } from "../dialect.js";

import type { DatabaseClient, PgDatabaseClient, SqliteDatabaseClient } from "./types.js";

/** Hex-encoded key pattern for SQLCipher encryption. */
const HEX_KEY_RE = /^[0-9a-fA-F]+$/;

/** AES-256 requires exactly 32 bytes = 64 hex characters. */
const REQUIRED_HEX_KEY_LENGTH = 64;

/** Configuration for creating a PG database client. */
export interface PgConfig {
  readonly dialect: "pg";
  readonly connectionString: string;
}

/** Configuration for creating a SQLite database client. */
export interface SqliteConfig {
  readonly dialect: "sqlite";
  readonly filename: string;
  /** Encryption key for SQLCipher. When provided, the database is encrypted at rest. */
  readonly encryptionKey?: string;
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
      const postgres = (await import("postgres")).default;
      const { drizzle } = await import("drizzle-orm/postgres-js");
      const client = postgres(config.connectionString);
      return { dialect: "pg", db: drizzle(client) };
    }
    case "sqlite": {
      // Validate key format before opening the database to avoid resource leaks.
      if (config.encryptionKey !== undefined) {
        if (
          config.encryptionKey.length !== REQUIRED_HEX_KEY_LENGTH ||
          !HEX_KEY_RE.test(config.encryptionKey)
        ) {
          throw new Error(
            `SQLITE_ENCRYPTION_KEY must be a ${String(REQUIRED_HEX_KEY_LENGTH)}-character hex string (32 bytes for AES-256)`,
          );
        }
      }
      const Database = (await import("better-sqlite3-multiple-ciphers")).default;
      const { drizzle } = await import("drizzle-orm/better-sqlite3");
      const client = new Database(config.filename);
      try {
        if (config.encryptionKey) {
          client.pragma(`cipher='sqlcipher'`);
          // Use x'...' hex literal to avoid SQL injection via single quotes in the key.
          client.pragma(`key="x'${config.encryptionKey}'"`);
        }
        client.pragma("journal_mode = WAL");
      } catch (err) {
        client.close();
        throw err;
      }
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
      const filename = process.env["DATABASE_PATH"];
      if (!filename) {
        console.warn("DATABASE_PATH not set, defaulting to 'pluralscape.db'");
      }
      const rawKey = process.env["SQLITE_ENCRYPTION_KEY"];
      if (rawKey !== undefined && rawKey === "") {
        throw new Error(
          "SQLITE_ENCRYPTION_KEY is set but empty — provide a valid hex key or unset the variable",
        );
      }
      return createDatabase({
        dialect: "sqlite",
        filename: filename ?? "pluralscape.db",
        encryptionKey: rawKey,
      });
    }
  }
}
