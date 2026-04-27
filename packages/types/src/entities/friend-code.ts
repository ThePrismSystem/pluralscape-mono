import type { AccountId, FriendCodeId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived } from "../utility.js";

/** An immutable, optionally expiring friend code used to initiate connections. */
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
 * Server-visible FriendCode metadata — raw Drizzle row shape.
 *
 * Plaintext entity. The domain type pins `archived: false` (callers interact
 * with either the live or the archived variant via the `Archived<T>`
 * helper), but the raw row carries the boolean column plus a nullable
 * `archivedAt` for the archivable consistency check.
 */
export type FriendCodeServerMetadata = Omit<FriendCode, "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/**
 * JSON-wire representation of a FriendCode (live or archived). Derived
 * from `FriendCodeServerMetadata` so the wire union covers both archive
 * states; branded IDs become plain strings, `UnixMillis` becomes `number`.
 */
export type FriendCodeWire = Serialize<FriendCodeServerMetadata>;
