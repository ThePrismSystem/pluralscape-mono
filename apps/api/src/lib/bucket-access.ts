import type { BucketAccessCheck, BucketId } from "@pluralscape/types";

/**
 * Check whether a friend has access to content using bucket intersection logic.
 *
 * Fail-closed: returns false if either set is empty or has no intersection.
 */
export function checkBucketAccess(check: BucketAccessCheck): boolean {
  if (check.friendBucketIds.length === 0 || check.contentBucketIds.length === 0) {
    return false;
  }

  const friendSet = new Set<string>(check.friendBucketIds);

  for (const bucketId of check.contentBucketIds) {
    if (friendSet.has(bucketId)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter a list of entities to only those visible to a friend via bucket intersection.
 *
 * An entity is visible if at least one of the friend's bucket IDs intersects
 * with the entity's tagged bucket IDs. Entities with no bucket tags are excluded
 * (fail-closed).
 */
export function filterVisibleEntities<T>(
  entities: readonly T[],
  friendBucketIds: readonly BucketId[],
  entityBucketMap: ReadonlyMap<string, readonly BucketId[]>,
  getEntityId: (entity: T) => string,
): T[] {
  if (friendBucketIds.length === 0) {
    return [];
  }

  const friendSet = new Set<string>(friendBucketIds);

  return entities.filter((entity) => {
    const entityId = getEntityId(entity);
    const contentBucketIds = entityBucketMap.get(entityId);

    if (!contentBucketIds || contentBucketIds.length === 0) {
      return false;
    }

    return contentBucketIds.some((id) => friendSet.has(id));
  });
}
