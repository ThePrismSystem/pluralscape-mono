import { bucketContentTags, members } from "@pluralscape/db/pg";
import { and, countDistinct, eq, inArray } from "drizzle-orm";

import type { BucketId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Count non-archived members visible to a friend via bucket intersection.
 *
 * Uses INNER JOIN on bucket_content_tags to count only members the friend
 * can see, preventing system size leakage (H2 security fix).
 */
export async function queryMemberCount(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<number> {
  if (friendBucketIds.length === 0) {
    return 0;
  }

  const [result] = await tx
    .select({ value: countDistinct(members.id) })
    .from(members)
    .innerJoin(
      bucketContentTags,
      and(
        eq(bucketContentTags.entityId, members.id),
        eq(bucketContentTags.systemId, members.systemId),
        eq(bucketContentTags.entityType, "member"),
      ),
    )
    .where(
      and(
        eq(members.systemId, systemId),
        eq(members.archived, false),
        inArray(bucketContentTags.bucketId, friendBucketIds),
      ),
    );

  return result?.value ?? 0;
}
