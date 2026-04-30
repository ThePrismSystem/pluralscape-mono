import { HTTP_BAD_REQUEST } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

/** Minimal structural type matching any Zod schema with safeParse. */
interface SafeParseable<T> {
  safeParse(
    data: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: readonly unknown[] } };
}

/**
 * Parse query parameters against a Zod schema, throwing ApiHttpError on
 * failure. The `details` field is the bare Zod issues array — matches
 * `parseBody` and what route tests assert
 * (`Array.isArray(body.error.details) === true`).
 */
export function parseQuery<T>(
  schema: SafeParseable<T>,
  query: Record<string, string | undefined>,
): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid query parameters",
      result.error.issues,
    );
  }
  return result.data;
}
