import type { AccountId, RecoveryKeyId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

/** An encrypted recovery key for account recovery. Immutable after creation. */
export interface RecoveryKey {
  readonly id: RecoveryKeyId;
  readonly accountId: AccountId;
  readonly encryptedMasterKey: Uint8Array;
  readonly recoveryKeyHash: Uint8Array | null;
  readonly createdAt: UnixMillis;
  readonly revokedAt: UnixMillis | null;
}

/**
 * Server-visible RecoveryKey metadata — raw Drizzle row shape.
 *
 * The DB row matches the domain `RecoveryKey` type exactly — recovery
 * keys are stored server-side as opaque blobs (wrapped under the
 * password-derived recovery key) with no additional server-only columns.
 */
export type RecoveryKeyServerMetadata = RecoveryKey;

/**
 * JSON-wire representation of a RecoveryKey. Derived from the domain
 * `RecoveryKey` type via `Serialize<T>`; branded IDs become plain strings,
 * `UnixMillis` becomes `number`, and `Uint8Array` becomes `string`
 * (base64).
 */
export type RecoveryKeyWire = Serialize<RecoveryKey>;
