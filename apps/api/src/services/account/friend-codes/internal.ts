import type {
  AccountId,
  Archivable,
  FriendCode,
  FriendCodeId,
  UnixMillis,
} from "@pluralscape/types";

export interface FriendCodeResult {
  readonly id: FriendCodeId;
  readonly accountId: AccountId;
  readonly code: string;
  readonly createdAt: UnixMillis;
  readonly expiresAt: UnixMillis | null;
  readonly archived: boolean;
}

export function toFriendCodeResult(input: Archivable<FriendCode>): FriendCodeResult {
  return {
    id: input.id,
    accountId: input.accountId,
    code: input.code,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    archived: input.archived,
  };
}
