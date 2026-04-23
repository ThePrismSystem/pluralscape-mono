import type { BucketKeyRotationId, BucketRotationItemId, EntityType } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { RotationState } from "./bucket-key-rotation.js";

/** Status of an individual item within a key rotation. */
export type RotationItemStatus = "pending" | "claimed" | "completed" | "failed";

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
