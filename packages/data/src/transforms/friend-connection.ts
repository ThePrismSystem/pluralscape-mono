import type { Archived, FriendConnection, UnixMillis } from "@pluralscape/types";

// ── Wire types ────────────────────────────────────────────────────────

/** Wire shape returned by `friendConnection.get` — derived from the `FriendConnection` domain type. */
export type FriendConnectionRaw = Omit<FriendConnection, "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `friendConnection.list`. */
export interface FriendConnectionPage {
  readonly data: readonly FriendConnectionRaw[];
  readonly nextCursor: string | null;
}

// ── Transforms ────────────────────────────────────────────────────────

/**
 * Narrow a single friend connection API result into a `FriendConnection` or `Archived<FriendConnection>`.
 */
export function narrowFriendConnection(
  raw: FriendConnectionRaw,
): FriendConnection | Archived<FriendConnection> {
  const base = {
    id: raw.id,
    accountId: raw.accountId,
    friendAccountId: raw.friendAccountId,
    status: raw.status,
    assignedBucketIds: raw.assignedBucketIds,
    visibility: raw.visibility,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived friendConnection missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Narrow a paginated friend connection list result.
 */
export function narrowFriendConnectionPage(raw: FriendConnectionPage): {
  data: (FriendConnection | Archived<FriendConnection>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map(narrowFriendConnection),
    nextCursor: raw.nextCursor,
  };
}
