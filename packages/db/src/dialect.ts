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
