import { HTTP_BAD_REQUEST } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";
import { parseJsonBody } from "./parse-json-body.js";

import type { Context } from "hono";

/** Minimal structural type matching any Zod schema with safeParse. */
interface SafeParseable<T> {
  safeParse(
    data: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: readonly unknown[] } };
}

/**
 * Parse a JSON request body against a Zod schema, throwing
 * ApiHttpError(400, VALIDATION_ERROR) on failure with the bare Zod
 * issues array attached to `details`. Mirrors `parseQuery` but for
 * request bodies.
 *
 * The `details` field is the bare issues array (not wrapped in
 * `{ issues: ... }`); matches what existing route tests assert
 * (`Array.isArray(body.error.details) === true`).
 */
export async function parseBody<T>(c: Context, schema: SafeParseable<T>): Promise<T> {
  const raw = await parseJsonBody(c);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }
  return parsed.data;
}
