import {
  guardedStr,
  guardedToMs,
  intToBool,
  parseJsonRequired,
  parseStringArray,
  rid,
  toMsOrNull,
  wrapArchived,
} from "./primitives.js";

import type {
  ArchivedFriendCode,
  ArchivedFriendConnection,
  FriendCode,
  FriendConnection,
  FriendVisibilitySettings,
} from "@pluralscape/types";

export function rowToFriendConnection(
  row: Record<string, unknown>,
): FriendConnection | ArchivedFriendConnection {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "friend_connections", "updated_at", id);
  const base: FriendConnection = {
    id: guardedStr(row["id"], "friend_connections", "id", id) as FriendConnection["id"],
    accountId: guardedStr(
      row["account_id"],
      "friend_connections",
      "account_id",
      id,
    ) as FriendConnection["accountId"],
    friendAccountId: guardedStr(
      row["friend_account_id"],
      "friend_connections",
      "friend_account_id",
      id,
    ) as FriendConnection["friendAccountId"],
    status: guardedStr(
      row["status"],
      "friend_connections",
      "status",
      id,
    ) as FriendConnection["status"],
    assignedBucketIds: parseStringArray(
      row["assigned_buckets"],
      "friend_connections",
      "assigned_buckets",
      id,
    ) as FriendConnection["assignedBucketIds"],
    visibility: parseJsonRequired(
      row["visibility"],
      "friend_connections",
      "visibility",
      id,
    ) as FriendVisibilitySettings,
    archived: false,
    createdAt: guardedToMs(row["created_at"], "friend_connections", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToFriendCode(row: Record<string, unknown>): FriendCode | ArchivedFriendCode {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const createdAt = guardedToMs(row["created_at"], "friend_codes", "created_at", id);
  const base: FriendCode = {
    id: guardedStr(row["id"], "friend_codes", "id", id) as FriendCode["id"],
    accountId: guardedStr(
      row["account_id"],
      "friend_codes",
      "account_id",
      id,
    ) as FriendCode["accountId"],
    code: guardedStr(row["code"], "friend_codes", "code", id),
    createdAt,
    expiresAt: toMsOrNull(row["expires_at"], "friend_codes", "expires_at", id),
    archived: false,
  };
  return archived ? wrapArchived(base, createdAt) : base;
}
