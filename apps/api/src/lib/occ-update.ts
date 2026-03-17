import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

/**
 * Asserts that an OCC (optimistic concurrency control) UPDATE returned exactly one row.
 * If zero rows were updated, checks whether the entity still exists to distinguish
 * between a version conflict (409) and a not-found (404).
 */
export async function assertOccUpdated<T>(
  updated: T[],
  existsFn: () => Promise<{ id: unknown } | undefined>,
  entityName: string,
): Promise<T> {
  if (updated.length > 0) {
    return updated[0] as T;
  }

  const existing = await existsFn();
  if (existing) {
    throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
  }
  throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${entityName} not found`);
}
