import { friendConnections } from "@pluralscape/db/pg";
import { brandId, toUnixMillis } from "@pluralscape/types";

import { encryptedBlobToBase64OrNull } from "../../lib/encrypted-blob.js";

import type {
  AccountId,
  BucketId,
  FriendConnectionId,
  FriendConnectionStatus,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface FriendConnectionResult {
  readonly id: FriendConnectionId;
  readonly accountId: AccountId;
  readonly friendAccountId: AccountId;
  readonly status: FriendConnectionStatus;
  readonly encryptedData: string | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

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
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}
