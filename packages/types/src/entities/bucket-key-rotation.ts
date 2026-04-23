import type { BucketId, BucketKeyRotationId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

/** State of a bucket key rotation operation. */
export type RotationState = "initiated" | "migrating" | "sealing" | "completed" | "failed";

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

/** Response from completing a rotation chunk. */
export interface ChunkCompletionResponse {
  readonly rotation: BucketKeyRotation;
  readonly transitioned: boolean;
}
