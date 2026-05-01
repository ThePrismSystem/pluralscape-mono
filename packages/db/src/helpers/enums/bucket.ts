/**
 * Bucket and privacy const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 */

import {
  BUCKET_CONTENT_ENTITY_TYPES,
  type BucketContentEntityType,
  type FriendConnectionStatus,
} from "@pluralscape/types";

export { BUCKET_CONTENT_ENTITY_TYPES };

export const FRIEND_CONNECTION_STATUSES = [
  "pending",
  "accepted",
  "blocked",
  "removed",
] as const satisfies readonly FriendConnectionStatus[];

/** Runtime validation for BucketContentEntityType — rejects unknown strings at the trust boundary. */
export function parseBucketContentEntityType(value: unknown): BucketContentEntityType {
  if (typeof value !== "string") {
    throw new Error(`Expected entity_type string, got ${typeof value}`);
  }
  const types: readonly string[] = BUCKET_CONTENT_ENTITY_TYPES;
  if (!types.includes(value)) {
    throw new Error(`Unknown BucketContentEntityType: ${value}`);
  }
  return value as BucketContentEntityType;
}
