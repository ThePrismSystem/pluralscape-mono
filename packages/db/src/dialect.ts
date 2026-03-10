/** SQL to enable pgcrypto for defense-in-depth encryption at rest. */
export const ENABLE_PGCRYPTO = "CREATE EXTENSION IF NOT EXISTS pgcrypto";

/** Supported database dialects. */
export type DbDialect = "pg" | "sqlite";

/**
 * Reads DB_DIALECT from the environment and validates it.
 * Throws if the variable is missing or not a valid dialect.
 */
export function getDialect(): DbDialect {
  const raw = process.env["DB_DIALECT"];
  if (raw === undefined || raw === "") {
    throw new Error("DB_DIALECT environment variable is required (expected 'pg' or 'sqlite')");
  }
  if (raw === "pg" || raw === "sqlite") {
    return raw;
  }
  throw new Error(`Invalid DB_DIALECT '${raw}' (expected 'pg' or 'sqlite')`);
}

/** Returns true if the current dialect is PostgreSQL. */
export function isPostgreSQL(): boolean {
  return getDialect() === "pg";
}

/** Returns true if the current dialect is SQLite. */
export function isSQLite(): boolean {
  return getDialect() === "sqlite";
}

/** Dialect capability matrix. */
export interface DialectCapabilities {
  /** Row-level security (server-enforced tenant isolation). */
  readonly rls: boolean;
  /** Native JSONB type with indexable operators. */
  readonly jsonb: boolean;
  /** Native array columns. */
  readonly arrays: boolean;
  /** pgcrypto extension for defense-in-depth encryption. */
  readonly pgcrypto: boolean;
  /** Native enum types. */
  readonly nativeEnums: boolean;
  /** Full-text search via tsvector/tsquery. */
  readonly fullTextSearch: boolean;
}

const PG_CAPABILITIES: DialectCapabilities = {
  rls: true,
  jsonb: true,
  arrays: true,
  pgcrypto: true,
  nativeEnums: true,
  fullTextSearch: true,
};

const SQLITE_CAPABILITIES: DialectCapabilities = {
  rls: false,
  jsonb: false,
  arrays: false,
  pgcrypto: false,
  nativeEnums: false,
  fullTextSearch: false,
};

/** Returns the capability matrix for the given dialect. */
export function getDialectCapabilities(dialect: DbDialect): DialectCapabilities {
  return dialect === "pg" ? PG_CAPABILITIES : SQLITE_CAPABILITIES;
}
