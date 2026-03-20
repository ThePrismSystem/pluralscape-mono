/**
 * Sparse fieldset support for list endpoints.
 *
 * Allows clients to request a subset of fields via `?fields=id,name`,
 * reducing payload size. The `id` field is always included.
 */

import { HTTP_BAD_REQUEST } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

/**
 * Parse a comma-separated `fields` query parameter into a set of field names.
 * Returns undefined if the parameter is not provided (meaning "all fields").
 * Always includes `id` in the result.
 *
 * Validates that all requested fields exist in the allowed set.
 * Throws 400 if an invalid field name is found.
 */
export function parseSparseFields(
  fieldsParam: string | undefined,
  allowedFields: readonly string[],
): ReadonlySet<string> | undefined {
  if (!fieldsParam) return undefined;

  const requested = fieldsParam
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  if (requested.length === 0) return undefined;

  const allowedSet = new Set(allowedFields);

  for (const field of requested) {
    if (!allowedSet.has(field)) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        `Unknown field: ${field}. Allowed fields: ${allowedFields.join(", ")}`,
      );
    }
  }

  const result = new Set(requested);
  result.add("id");
  return result;
}

/**
 * Filter an object to only include the specified fields.
 * If `fields` is undefined, returns the original object unchanged.
 */
export function filterFields<T extends object>(item: T, fields: undefined): T;
export function filterFields<T extends object>(item: T, fields: ReadonlySet<string>): Partial<T>;
export function filterFields<T extends object>(
  item: T,
  fields: ReadonlySet<string> | undefined,
): T | Partial<T>;
export function filterFields<T extends object>(
  item: T,
  fields: ReadonlySet<string> | undefined,
): T | Partial<T> {
  if (!fields) return item;

  const result: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in item) {
      result[key] = (item as Record<string, unknown>)[key];
    }
  }
  return result as Partial<T>;
}
