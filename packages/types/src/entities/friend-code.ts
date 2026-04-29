import type { AccountId, FriendCodeId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archivable, Archived } from "../utility.js";

/** An immutable, optionally expiring friend code used to initiate connections (live state). */
export interface FriendCode {
  readonly id: FriendCodeId;
  readonly accountId: AccountId;
  readonly code: string;
  readonly createdAt: UnixMillis;
  readonly expiresAt: UnixMillis | null;
  readonly archived: false;
}

/** An archived friend code. */
export type ArchivedFriendCode = Archived<FriendCode>;

/**
 * Server-visible FriendCode metadata.
 *
 * Discriminated union of the live and archived shapes — the database CHECK
 * invariant `(archived = true) = (archived_at IS NOT NULL)` is encoded in
 * the type system here. Recover this shape from a flat Drizzle row via
 * `narrowArchivableRow` (apps/api/src/lib/archivable-row.ts).
 */
export type FriendCodeServerMetadata = Archivable<FriendCode>;

/**
 * JSON-wire FriendCode (live or archived) — discriminated.
 *
 * `Serialize` distributes over the underlying union, so this type is the
 * discriminated wire union: `Serialize<FriendCode> |
 * Serialize<Archived<FriendCode>>`. Branded IDs and `UnixMillis` are
 * stripped at the wire boundary.
 */
export type FriendCodeWire = Serialize<FriendCodeServerMetadata>;
