import { PG_UNIQUE_VIOLATION } from "../db.constants.js";
import { HTTP_CONFLICT } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

/** Maximum depth to walk error cause chains (prevents infinite loops). */
const MAX_CAUSE_DEPTH = 10;

/**
 * Returns true when `error` is a PostgreSQL unique-constraint violation.
 *
 * Walks the full `.cause` chain (up to MAX_CAUSE_DEPTH) looking for
 * `code === "23505"`, since Drizzle ORM may wrap driver errors in
 * multiple layers of `DrizzleQueryError`.
 */
export function isUniqueViolation(error: unknown): error is Error & { code: string } {
  if (!(error instanceof Error)) return false;
  let current: unknown = error;
  let depth = 0;
  while (current instanceof Error && depth < MAX_CAUSE_DEPTH) {
    if ("code" in current && current.code === PG_UNIQUE_VIOLATION) return true;
    current = current.cause;
    depth++;
  }
  return false;
}

/**
 * Re-throws `error` as a 409 CONFLICT ApiHttpError when it is a PostgreSQL
 * unique-constraint violation; otherwise re-throws the original error.
 *
 * Use inside a `catch` block to replace the repeated pattern:
 *
 * ```ts
 * } catch (error) {
 *   throwOnUniqueViolation(error, "Link already exists");
 * }
 * ```
 */
export function throwOnUniqueViolation(error: unknown, message: string): never {
  if (isUniqueViolation(error)) {
    throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", message);
  }
  throw error;
}
