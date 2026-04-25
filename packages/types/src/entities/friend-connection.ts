import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { AccountId, BucketId, FriendConnectionId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** Status of a friend connection between two systems. */
export type FriendConnectionStatus = "pending" | "accepted" | "blocked" | "removed";

/** Per-friend visibility toggles — controls what a friend can see beyond bucket access. */
export interface FriendVisibilitySettings {
  readonly showMembers: boolean;
  readonly showGroups: boolean;
  readonly showStructure: boolean;
  readonly allowFrontingNotifications: boolean;
}

/** A mutable friend connection between two accounts. */
export interface FriendConnection extends AuditMetadata {
  readonly id: FriendConnectionId;
  readonly accountId: AccountId;
  readonly friendAccountId: AccountId;
  readonly status: FriendConnectionStatus;
  readonly assignedBucketIds: readonly BucketId[];
  readonly visibility: FriendVisibilitySettings;
  readonly archived: false;
}

/** An archived friend connection. */
export type ArchivedFriendConnection = Archived<FriendConnection>;

/**
 * Keys of `FriendConnection` that are encrypted client-side before the
 * server sees them. The `visibility` blob is the only domain field that
 * lives inside `encryptedData`; `assignedBucketIds` is plaintext but
 * derived from a junction table, not a column on this entity.
 */
export type FriendConnectionEncryptedFields = "visibility";

/**
 * Pre-encryption shape — what `encryptFriendConnectionInput` accepts.
 * Single source of truth: derived from `FriendConnection` via `Pick<>`
 * over the encrypted-keys union.
 */
export type FriendConnectionEncryptedInput = Pick<
  FriendConnection,
  FriendConnectionEncryptedFields
>;

/**
 * Server-visible FriendConnection metadata — raw Drizzle row shape.
 *
 * Hybrid entity: the domain carries derived fields (`assignedBucketIds`
 * comes from the `friend_bucket_assignments` junction table, `visibility`
 * comes from the decrypted `encryptedData` T1 blob) that do not exist as
 * columns on `friend_connections`. The server row strips those derived
 * keys and replaces them with the nullable `encryptedData` column — nullable
 * because a connection can exist in `pending` status before the grantor
 * writes a visibility blob. `archived` relaxes to the raw boolean column
 * plus its `archivedAt` companion.
 */
export type FriendConnectionServerMetadata = Omit<
  FriendConnection,
  FriendConnectionEncryptedFields | "assignedBucketIds" | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob | null;
};

/**
 * Server-emit shape — what `toFriendConnectionResult` returns. Branded
 * IDs and timestamps preserved; `encryptedData` is wire-form
 * `EncryptedBase64 | null` (nullable because pending connections have
 * no visibility blob yet).
 */
export type FriendConnectionResult = EncryptedWire<FriendConnectionServerMetadata>;

/**
 * JSON-serialized wire form of `FriendConnectionResult`: branded IDs
 * become plain strings; `EncryptedBase64 | null` becomes `string | null`;
 * timestamps become numbers.
 */
export type FriendConnectionWire = Serialize<FriendConnectionResult>;

/** A junction mapping a friend connection to a privacy bucket. */
export interface FriendBucketAssignment {
  readonly friendConnectionId: FriendConnectionId;
  readonly bucketId: BucketId;
}
