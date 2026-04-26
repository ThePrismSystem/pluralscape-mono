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

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// FriendConnectionEncryptedInput → FriendConnectionServerMetadata
//                               → FriendConnectionResult → FriendConnectionWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type FriendConnectionEncryptedInput = Pick<
  FriendConnection,
  FriendConnectionEncryptedFields
>;

/**
 * Domain keys omitted from `FriendConnectionServerMetadata` for one of three
 * orthogonal reasons:
 *
 * 1. **Junction-table derivation** — `assignedBucketIds` is computed by
 *    joining the `bucket_friend_connections` junction table at read time,
 *    not stored on the friend-connection row.
 * 2. **Encrypted-blob derivation** — `visibility` lives inside the T1
 *    `encryptedData` blob; the server never sees its plaintext form.
 * 3. **Domain-only convention** — `archived` exists on the domain as a
 *    discriminated literal (widens to `boolean` server-side), so the omit
 *    avoids the type collision.
 *
 * @see FriendConnectionServerMetadata
 */
export type FriendConnectionAuxOmitFields = "assignedBucketIds";

/**
 * Server-visible FriendConnection metadata — raw Drizzle row shape.
 *
 * The Omit clause names three orthogonal reasons a domain key is absent
 * from the server row — see {@link FriendConnectionAuxOmitFields} for the
 * full enumeration. Adds the nullable `encryptedData` column (nullable
 * because pending connections have no visibility blob yet) and `archivedAt`.
 */
export type FriendConnectionServerMetadata = Omit<
  FriendConnection,
  FriendConnectionEncryptedFields | FriendConnectionAuxOmitFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob | null;
};

/**
 * `encryptedData` is `EncryptedBase64 | null` (nullable because pending
 * connections have no visibility blob yet).
 */
export type FriendConnectionResult = EncryptedWire<FriendConnectionServerMetadata>;

export type FriendConnectionWire = Serialize<FriendConnectionResult>;

/** A junction mapping a friend connection to a privacy bucket. */
export interface FriendBucketAssignment {
  readonly friendConnectionId: FriendConnectionId;
  readonly bucketId: BucketId;
}
