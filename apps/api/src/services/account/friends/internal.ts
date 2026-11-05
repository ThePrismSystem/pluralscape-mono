import { friendConnections } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64OrNull } from "../../../lib/encrypted-blob.js";

import type {
  FriendConnectionResult,
  AccountId,
  BucketId,
  FriendConnectionId,
  SystemId,
} from "@pluralscape/types";

export interface FriendConnectionWithRotations extends FriendConnectionResult {
  readonly pendingRotations: ReadonlyArray<{
    readonly systemId: SystemId;
    readonly bucketId: BucketId;
  }>;
}

export function toFriendConnectionResult(
  row: typeof friendConnections.$inferSelect,
): FriendConnectionResult {
  return {
    id: brandId<FriendConnectionId>(row.id),
    accountId: brandId<AccountId>(row.accountId),
    friendAccountId: brandId<AccountId>(row.friendAccountId),
    status: row.status,
    encryptedData: encryptedBlobToBase64OrNull(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}
