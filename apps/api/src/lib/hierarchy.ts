import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { MAX_ANCESTOR_DEPTH } from "../service.constants.js";

import { ApiHttpError } from "./api-error.js";

/**
 * Walk ancestors from `startId` up to the root, throwing if `targetId` is
 * encountered (cycle) or the depth limit is exceeded.
 *
 * @param getParentId Callback that returns the parent ID for a given entity.
 *   Return `null` for root (no parent) or `undefined` if the entity was not found.
 */
export async function detectAncestorCycle(
  getParentId: (id: string) => Promise<string | null | undefined>,
  startId: string,
  targetId: string,
  entityName: string,
): Promise<void> {
  let currentId: string | null = startId;

  for (let i = 0; i < MAX_ANCESTOR_DEPTH && currentId !== null; i++) {
    if (currentId === targetId) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Circular reference detected");
    }

    const parentId = await getParentId(currentId);

    if (parentId === undefined) {
      throw new ApiHttpError(
        HTTP_NOT_FOUND,
        "NOT_FOUND",
        `${entityName} hierarchy integrity violation`,
      );
    }

    currentId = parentId;
  }

  if (currentId !== null) {
    throw new ApiHttpError(
      HTTP_CONFLICT,
      "CONFLICT",
      `${entityName} hierarchy too deep or contains a cycle`,
    );
  }
}
