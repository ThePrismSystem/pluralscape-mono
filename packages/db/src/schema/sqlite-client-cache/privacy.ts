import { foreignKey, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type {
  AccountId,
  BucketContentEntityType,
  BucketId,
  EntityTypeIdMap,
  FriendCodeId,
  FriendConnectionId,
  FriendConnectionStatus,
  FriendVisibilitySettings,
  KeyGrantId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `PrivacyBucket`.
 */
export const buckets = sqliteTable("buckets", {
  ...entityIdentity<BucketId>(),
  name: text("name").notNull(),
  description: text("description"),
  ...timestamps(),
  ...archivable(),
});

/**
 * CARVE-OUT (ADR-038): junction-storage entity. The compound CRDT key
 * `entityType:entityId:bucketId` is the row identity; the parsed parts
 * ride as separate columns for indexed lookups. No `entityIdentity()`
 * mixin (junctions carry no metadata beyond presence). The `entityId`
 * column is typed as the union of every brand reachable from
 * {@link BucketContentEntityType}, so consumers see the strongest type
 * the discriminator union allows.
 */
export const bucketContentTags = sqliteTable("bucket_content_tags", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").$type<BucketContentEntityType>().notNull(),
  entityId: brandedId<EntityTypeIdMap[BucketContentEntityType]>("entity_id").notNull(),
  bucketId: brandedId<BucketId>("bucket_id").notNull(),
});

/**
 * Decrypted client-cache projection of `KeyGrant`. The server stores the
 * encrypted bucket key in `encryptedKey`; the cache mirrors that name.
 */
export const keyGrants = sqliteTable(
  "key_grants",
  {
    ...entityIdentity<KeyGrantId>(),
    bucketId: brandedId<BucketId>("bucket_id").notNull(),
    friendAccountId: brandedId<AccountId>("friend_account_id").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    keyVersion: integer("key_version").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
    revokedAt: sqliteTimestamp("revoked_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.bucketId, t.systemId],
      foreignColumns: [buckets.id, buckets.systemId],
    }).onDelete("restrict"),
  ],
);

/**
 * Decrypted client-cache projection of `FriendConnection`. Account-scoped
 * — entityIdentity does not fit (no systemId on the domain type).
 * `assignedBucketIds` lives in a separate junction table.
 */
export const friendConnections = sqliteTable("friend_connections", {
  id: brandedId<FriendConnectionId>("id").primaryKey(),
  accountId: brandedId<AccountId>("account_id").notNull(),
  friendAccountId: brandedId<AccountId>("friend_account_id").notNull(),
  status: text("status").$type<FriendConnectionStatus>().notNull(),
  visibility: sqliteJsonOf<FriendVisibilitySettings>("visibility").notNull(),
  ...timestamps(),
  ...archivable(),
});

/**
 * Decrypted client-cache projection of `FriendCode`. Account-scoped —
 * entityIdentity does not fit.
 */
export const friendCodes = sqliteTable("friend_codes", {
  id: brandedId<FriendCodeId>("id").primaryKey(),
  accountId: brandedId<AccountId>("account_id").notNull(),
  code: text("code").notNull(),
  createdAt: sqliteTimestamp("created_at").notNull(),
  expiresAt: sqliteTimestamp("expires_at"),
  ...archivable(),
});

export type LocalBucketRow = InferSelectModel<typeof buckets>;
export type NewLocalBucket = InferInsertModel<typeof buckets>;
export type LocalBucketContentTagRow = InferSelectModel<typeof bucketContentTags>;
export type NewLocalBucketContentTag = InferInsertModel<typeof bucketContentTags>;
export type LocalKeyGrantRow = InferSelectModel<typeof keyGrants>;
export type NewLocalKeyGrant = InferInsertModel<typeof keyGrants>;
export type LocalFriendConnectionRow = InferSelectModel<typeof friendConnections>;
export type NewLocalFriendConnection = InferInsertModel<typeof friendConnections>;
export type LocalFriendCodeRow = InferSelectModel<typeof friendCodes>;
export type NewLocalFriendCode = InferInsertModel<typeof friendCodes>;
