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
  "assignedBucketIds" | "visibility" | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob | null;
};

/**
 * JSON-wire representation of a FriendConnection. Derived from the domain
 * `FriendConnection` type via `Serialize<T>`; branded IDs become plain
 * strings, `UnixMillis` becomes `number`.
 */
export type FriendConnectionWire = Serialize<FriendConnection>;

/** A junction mapping a friend connection to a privacy bucket. */
export interface FriendBucketAssignment {
  readonly friendConnectionId: FriendConnectionId;
  readonly bucketId: BucketId;
}
