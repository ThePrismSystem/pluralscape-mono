import { PG_FK_VIOLATION } from "../db.constants.js";

/** Maximum depth to walk error cause chains (prevents infinite loops). */
const MAX_CAUSE_DEPTH = 10;

/**
 * Returns true when `error` contains a PostgreSQL error with the given code.
 *
 * Walks the full `.cause` chain (up to {@link MAX_CAUSE_DEPTH}) looking for
 * a matching `code` property, since Drizzle ORM may wrap driver errors in
 * multiple layers of `DrizzleQueryError`.
 */
export function isPgErrorCode(error: unknown, code: string): error is Error & { code: string } {
  if (!(error instanceof Error)) return false;
  let current: unknown = error;
  let depth = 0;
  while (current instanceof Error && depth < MAX_CAUSE_DEPTH) {
    if ("code" in current && current.code === code) return true;
    current = current.cause;
    depth++;
  }
  return false;
}

/**
 * Returns true when `error` is a PostgreSQL foreign-key constraint violation.
 * Delegates to {@link isPgErrorCode} with code `23503`.
 */
export function isFkViolation(error: unknown): error is Error & { code: string } {
  return isPgErrorCode(error, PG_FK_VIOLATION);
}
