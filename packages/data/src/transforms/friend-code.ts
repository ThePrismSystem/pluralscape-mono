import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import type {
  AccountId,
  Archivable,
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
export function narrowFriendCode(raw: FriendCodeWire): Archivable<FriendCode> {
  const base = {
    id: brandId<FriendCodeId>(raw.id),
    accountId: brandId<AccountId>(raw.accountId),
    code: raw.code,
    createdAt: toUnixMillis(raw.createdAt),
    expiresAt: toUnixMillisOrNull(raw.expiresAt),
  };

  if (raw.archived) {
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

/** Narrow a paginated friend code list. */
export function narrowFriendCodePage(raw: FriendCodePage): {
  data: Archivable<FriendCode>[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map(narrowFriendCode),
    nextCursor: raw.nextCursor,
  };
}
