import type { BucketId, BucketKeyRotationId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

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

/**
 * Server-visible BucketKeyRotation metadata — raw Drizzle row shape.
 *
 * Plaintext entity: the row mirrors the domain type. The only addition is
 * the owning `systemId` column (FK cascade), which the domain type omits
 * because callers always operate in a system-scoped context.
 */
export interface BucketKeyRotationServerMetadata extends BucketKeyRotation {
  readonly systemId: SystemId;
}

/**
 * JSON-wire representation of a BucketKeyRotation. Derived from the domain
 * type via `Serialize<T>`; branded IDs become plain strings, `UnixMillis`
 * becomes `number`.
 */
export type BucketKeyRotationWire = Serialize<BucketKeyRotation>;

/** Response from completing a rotation chunk. */
export interface ChunkCompletionResponse {
  readonly rotation: BucketKeyRotation;
  readonly transitioned: boolean;
}
