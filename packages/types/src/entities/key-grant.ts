import type { AccountId, BucketId, KeyGrantId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

/**
 * An immutable grant of a bucket's encryption key to a friend.
 * Created when granting access, optionally revoked. Never updated.
 */
export interface KeyGrant {
  readonly id: KeyGrantId;
  readonly bucketId: BucketId;
  readonly friendAccountId: AccountId;
  /** Encrypted symmetric key for the bucket. Serialized to base64 at API transport boundaries. */
  readonly encryptedBucketKey: Uint8Array;
  readonly keyVersion: number;
  readonly createdAt: UnixMillis;
  readonly revokedAt: UnixMillis | null;
}

/**
 * Server-visible KeyGrant metadata — raw Drizzle row shape.
 *
 * Plaintext entity — `encryptedBucketKey` is an end-to-end ciphertext the
 * server treats opaquely, not a client-side encrypted field. The row
 * renames the column to `encryptedKey` and adds the owning `systemId` FK
 * (cascade) so ownership is enforced alongside the friend cascade.
 */
export type KeyGrantServerMetadata = Omit<KeyGrant, "encryptedBucketKey"> & {
  readonly systemId: SystemId;
  readonly encryptedKey: Uint8Array;
};

/**
 * JSON-wire representation of a KeyGrant. Derived from the domain type via
 * `Serialize<T>`; branded IDs become plain strings, `UnixMillis` becomes
 * `number`, and `Uint8Array` becomes `string` (base64).
 *
 * NB: Wire is derived from the domain type (not `KeyGrantServerMetadata`)
 * because the server row renames the column to `encryptedKey` and adds
 * the owning `systemId` FK, neither of which the API exposes.
 */
export type KeyGrantWire = Serialize<KeyGrant>;

/** An active key grant as seen by the recipient account (across all friends). */
export interface ReceivedKeyGrant {
  readonly id: KeyGrantId;
  readonly bucketId: BucketId;
  readonly encryptedKey: string;
  readonly keyVersion: number;
  readonly grantorSystemId: SystemId;
  /** Base64url-encoded box public key of the grantor account (needed for decryption). */
  readonly senderBoxPublicKey: string;
}

/** Response from the bulk listReceivedKeyGrants endpoint. */
export interface ReceivedKeyGrantsResponse {
  readonly grants: readonly ReceivedKeyGrant[];
}
