import type { AccountId, FriendCodeId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
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
