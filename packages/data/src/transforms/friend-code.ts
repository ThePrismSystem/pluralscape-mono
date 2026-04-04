import type { Archived, FriendCode, UnixMillis } from "@pluralscape/types";

// ── Wire types ────────────────────────────────────────────────────────

/**
 * Wire shape returned by `friendCode.get` — derived from the `FriendCode` domain type.
 * Note: `FriendCode` does NOT extend `AuditMetadata` — no `version` or `updatedAt`.
 */
export type FriendCodeRaw = Omit<FriendCode, "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `friendCode.list`. */
export interface FriendCodePage {
  readonly data: readonly FriendCodeRaw[];
  readonly nextCursor: string | null;
}

// ── Transforms ────────────────────────────────────────────────────────

/**
 * Narrow a single friend code API result into a `FriendCode` or `Archived<FriendCode>`.
 */
export function narrowFriendCode(raw: FriendCodeRaw): FriendCode | Archived<FriendCode> {
  const base = {
    id: raw.id,
    accountId: raw.accountId,
    code: raw.code,
    createdAt: raw.createdAt,
    expiresAt: raw.expiresAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived friendCode missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Narrow a paginated friend code list result.
 */
export function narrowFriendCodePage(raw: FriendCodePage): {
  data: (FriendCode | Archived<FriendCode>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map(narrowFriendCode),
    nextCursor: raw.nextCursor,
  };
}
