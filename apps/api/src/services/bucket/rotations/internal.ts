import { bucketKeyRotations } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import type { BucketId, BucketKeyRotation, BucketKeyRotationId } from "@pluralscape/types";

export function toRotationResult(row: typeof bucketKeyRotations.$inferSelect): BucketKeyRotation {
  return {
    id: brandId<BucketKeyRotationId>(row.id),
    bucketId: brandId<BucketId>(row.bucketId),
    fromKeyVersion: row.fromKeyVersion,
    toKeyVersion: row.toKeyVersion,
    state: row.state,
    initiatedAt: toUnixMillis(row.initiatedAt),
    completedAt: toUnixMillisOrNull(row.completedAt),
    totalItems: row.totalItems,
    completedItems: row.completedItems,
    failedItems: row.failedItems,
  };
}
