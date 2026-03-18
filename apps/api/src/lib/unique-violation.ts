import { PG_UNIQUE_VIOLATION } from "../db.constants.js";
import { HTTP_CONFLICT } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

/**
 * Returns true when `error` is a PostgreSQL unique-constraint violation.
 *
 * Checks for the `code` property set to `"23505"` on Error instances,
 * matching the shape produced by the postgres.js driver.
 */
export function isUniqueViolation(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error && error.code === PG_UNIQUE_VIOLATION;
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
