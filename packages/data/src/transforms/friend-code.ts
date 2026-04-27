import { brandId, toUnixMillis } from "@pluralscape/types";

import type {
  AccountId,
  Archived,
  FriendCode,
  FriendCodeId,
  FriendCodeWire,
} from "@pluralscape/types";

/** Shape returned by `friendCode.list`. */
export interface FriendCodePage {
  readonly data: readonly FriendCodeWire[];
  readonly nextCursor: string | null;
}

/** Narrow a wire friend code; re-brands stripped IDs/timestamps. */
export function narrowFriendCode(raw: FriendCodeWire): FriendCode | Archived<FriendCode> {
  const base = {
    id: brandId<FriendCodeId>(raw.id),
    accountId: brandId<AccountId>(raw.accountId),
    code: raw.code,
    createdAt: toUnixMillis(raw.createdAt),
    expiresAt: raw.expiresAt === null ? null : toUnixMillis(raw.expiresAt),
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived friendCode missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

/** Narrow a paginated friend code list. */
export function narrowFriendCodePage(raw: FriendCodePage): {
  data: (FriendCode | Archived<FriendCode>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map(narrowFriendCode),
    nextCursor: raw.nextCursor,
  };
}
