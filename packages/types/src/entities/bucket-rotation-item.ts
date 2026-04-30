import type { BucketKeyRotationId, BucketRotationItemId, EntityType, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
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

/**
 * Server-visible BucketRotationItem metadata — raw Drizzle row shape.
 *
 * Plaintext entity: the row mirrors the domain type plus the owning
 * `systemId` column (FK cascade), which the domain omits because callers
 * always operate in a system-scoped context.
 */
export interface BucketRotationItemServerMetadata extends BucketRotationItem {
  readonly systemId: SystemId;
}

/**
 * JSON-wire representation of a BucketRotationItem. Derived from the domain
 * type via `Serialize<T>`; branded IDs become plain strings, `UnixMillis`
 * becomes `number`.
 *
 * NB: Wire is derived from the domain type (not
 * `BucketRotationItemServerMetadata`) because the server row adds the
 * owning `systemId` FK that the API does not expose.
 */
export type BucketRotationItemWire = Serialize<BucketRotationItem>;

/** Response from claiming a rotation chunk. */
export interface ChunkClaimResponse {
  readonly data: readonly BucketRotationItem[];
  readonly rotationState: RotationState;
}
