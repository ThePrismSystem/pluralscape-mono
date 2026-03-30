import type { BucketId, BucketKeyRotationId, BucketRotationItemId, EntityType } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** State of a bucket key rotation operation. */
export type RotationState = "initiated" | "migrating" | "sealing" | "completed" | "failed";

/** Status of an individual item within a key rotation. */
export type RotationItemStatus = "pending" | "claimed" | "completed" | "failed";

/** Tracks a key rotation operation for a privacy bucket. */
export interface BucketKeyRotation {
  readonly id: BucketKeyRotationId;
  readonly bucketId: BucketId;
  readonly fromKeyVersion: number;
  readonly toKeyVersion: number;
  readonly state: RotationState;
  readonly initiatedAt: UnixMillis;
  readonly completedAt: UnixMillis | null;
  readonly totalItems: number;
  readonly completedItems: number;
  readonly failedItems: number;
}

/** Tracks an individual entity being re-encrypted during a key rotation. */
export interface BucketRotationItem {
  readonly id: BucketRotationItemId;
  readonly rotationId: BucketKeyRotationId;
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly status: RotationItemStatus;
  readonly claimedBy: string | null;
  readonly claimedAt: UnixMillis | null;
  readonly completedAt: UnixMillis | null;
  readonly attempts: number;
}

/** Response from claiming a rotation chunk. */
export interface ChunkClaimResponse {
  readonly data: readonly BucketRotationItem[];
  readonly rotationState: RotationState;
}

/** Response from completing a rotation chunk. */
export interface ChunkCompletionResponse {
  readonly rotation: BucketKeyRotation;
  readonly transitioned: boolean;
}
