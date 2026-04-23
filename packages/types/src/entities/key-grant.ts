import type { AccountId, BucketId, KeyGrantId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

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
