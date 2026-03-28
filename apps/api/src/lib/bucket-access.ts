import { bucketContentTags } from "@pluralscape/db/pg";
import { and, eq, inArray } from "drizzle-orm";

import { MAX_IN_CLAUSE_SIZE } from "../service.constants.js";

import type {
  BucketAccessCheck,
  BucketContentEntityType,
  BucketId,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Load bucket content tags for a set of entities and build a map
 * from entity ID to bucket IDs.
 *
 * Batches the IN clause when entityIds exceeds MAX_IN_CLAUSE_SIZE
 * to avoid hitting PostgreSQL parameter limits.
 */
export async function loadBucketTags(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  entityType: BucketContentEntityType,
  entityIds: readonly string[],
): Promise<ReadonlyMap<string, readonly BucketId[]>> {
  if (entityIds.length === 0) {
    return new Map();
  }

  const map = new Map<string, BucketId[]>();

  for (let offset = 0; offset < entityIds.length; offset += MAX_IN_CLAUSE_SIZE) {
    const batch = entityIds.slice(offset, offset + MAX_IN_CLAUSE_SIZE);

    const tags = await tx
      .select({
        entityId: bucketContentTags.entityId,
        bucketId: bucketContentTags.bucketId,
      })
      .from(bucketContentTags)
      .where(
        and(
          eq(bucketContentTags.systemId, systemId),
          eq(bucketContentTags.entityType, entityType),
          inArray(bucketContentTags.entityId, batch),
        ),
      );

    for (const tag of tags) {
      const existing = map.get(tag.entityId);
      if (existing) {
        existing.push(tag.bucketId as BucketId);
      } else {
        map.set(tag.entityId, [tag.bucketId as BucketId]);
      }
    }
  }

  return map;
}

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
