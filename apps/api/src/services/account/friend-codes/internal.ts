import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { friendCodes } from "@pluralscape/db/pg";

import type { AccountId, FriendCodeId, UnixMillis } from "@pluralscape/types";

export interface FriendCodeResult {
  readonly id: FriendCodeId;
  readonly accountId: AccountId;
  readonly code: string;
  readonly createdAt: UnixMillis;
  readonly expiresAt: UnixMillis | null;
  readonly archived: boolean;
}

export function toFriendCodeResult(row: typeof friendCodes.$inferSelect): FriendCodeResult {
  return {
    id: brandId<FriendCodeId>(row.id),
    accountId: brandId<AccountId>(row.accountId),
    code: row.code,
    createdAt: toUnixMillis(row.createdAt),
    expiresAt: toUnixMillisOrNull(row.expiresAt),
    archived: row.archived,
  };
}
