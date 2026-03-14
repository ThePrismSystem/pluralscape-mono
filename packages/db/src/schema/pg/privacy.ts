import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { pgBinary, pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  timestamps,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/constants.js";
import { BUCKET_CONTENT_ENTITY_TYPES, FRIEND_CONNECTION_STATUSES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { systems } from "./systems.js";

import type { BucketContentEntityType, FriendConnectionStatus } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const buckets = pgTable(
  "buckets",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("buckets_system_archived_idx").on(t.systemId, t.archived),
    unique("buckets_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("buckets", t.version),
    archivableConsistencyCheckFor("buckets", t.archived, t.archivedAt),
  ],
);

export const bucketContentTags = pgTable(
  "bucket_content_tags",
  {
    entityType: varchar("entity_type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<BucketContentEntityType>(),
    entityId: varchar("entity_id", { length: ID_MAX_LENGTH }).notNull(),
    bucketId: varchar("bucket_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => buckets.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.entityType, t.entityId, t.bucketId] }),
    index("bucket_content_tags_bucket_id_idx").on(t.bucketId),
    index("bucket_content_tags_system_id_idx").on(t.systemId),
    check(
      "bucket_content_tags_entity_type_check",
      enumCheck(t.entityType, BUCKET_CONTENT_ENTITY_TYPES),
    ),
  ],
);

export const keyGrants = pgTable(
  "key_grants",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    bucketId: varchar("bucket_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => buckets.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    friendAccountId: varchar("friend_account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    encryptedKey: pgBinary("encrypted_key").notNull(),
    keyVersion: integer("key_version").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
    revokedAt: pgTimestamp("revoked_at"),
  },
  (t) => [
    index("key_grants_system_id_idx").on(t.systemId),
    index("key_grants_friend_bucket_idx").on(t.friendAccountId, t.bucketId),
    index("key_grants_friend_revoked_idx").on(t.friendAccountId, t.revokedAt),
    index("key_grants_revoked_at_idx").on(t.revokedAt),
    unique("key_grants_bucket_friend_version_uniq").on(t.bucketId, t.friendAccountId, t.keyVersion),
    check("key_grants_key_version_check", sql`${t.keyVersion} >= 1`),
  ],
);

// Connections are intentionally directional: A→B and B→A are separate entries
// Friend connections are account-level (not system-level) to support non-system viewer accounts.
export const friendConnections = pgTable(
  "friend_connections",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    friendAccountId: varchar("friend_account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("pending")
      .$type<FriendConnectionStatus>(),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    ...timestamps(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("friend_connections_account_status_idx").on(t.accountId, t.status),
    index("friend_connections_friend_status_idx").on(t.friendAccountId, t.status),
    index("friend_connections_account_archived_idx").on(t.accountId, t.archived),
    uniqueIndex("friend_connections_account_friend_uniq")
      .on(t.accountId, t.friendAccountId)
      .where(sql`${t.archived} = false`),
    unique("friend_connections_id_account_id_unique").on(t.id, t.accountId),
    check("friend_connections_status_check", enumCheck(t.status, FRIEND_CONNECTION_STATUSES)),
    check("friend_connections_no_self_check", sql`${t.accountId} != ${t.friendAccountId}`),
    versionCheckFor("friend_connections", t.version),
    archivableConsistencyCheckFor("friend_connections", t.archived, t.archivedAt),
  ],
);

export const friendCodes = pgTable(
  "friend_codes",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 255 }).notNull().unique(),
    createdAt: pgTimestamp("created_at").notNull(),
    expiresAt: pgTimestamp("expires_at"),
    ...archivable(),
  },
  (t) => [
    index("friend_codes_account_id_idx").on(t.accountId),
    check(
      "friend_codes_expires_at_check",
      sql`${t.expiresAt} IS NULL OR ${t.expiresAt} > ${t.createdAt}`,
    ),
    check("friend_codes_code_min_length_check", sql`length(${t.code}) >= 8`),
    archivableConsistencyCheckFor("friend_codes", t.archived, t.archivedAt),
  ],
);

export const friendBucketAssignments = pgTable(
  "friend_bucket_assignments",
  {
    friendConnectionId: varchar("friend_connection_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => friendConnections.id, { onDelete: "cascade" }),
    bucketId: varchar("bucket_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => buckets.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.friendConnectionId, t.bucketId] }),
    index("friend_bucket_assignments_bucket_id_idx").on(t.bucketId),
    index("friend_bucket_assignments_system_id_idx").on(t.systemId),
  ],
);

export type BucketRow = InferSelectModel<typeof buckets>;
export type NewBucket = InferInsertModel<typeof buckets>;
export type BucketContentTagRow = InferSelectModel<typeof bucketContentTags>;
export type NewBucketContentTag = InferInsertModel<typeof bucketContentTags>;
export type KeyGrantRow = InferSelectModel<typeof keyGrants>;
export type NewKeyGrant = InferInsertModel<typeof keyGrants>;
export type FriendConnectionRow = InferSelectModel<typeof friendConnections>;
export type NewFriendConnection = InferInsertModel<typeof friendConnections>;
export type FriendCodeRow = InferSelectModel<typeof friendCodes>;
export type NewFriendCode = InferInsertModel<typeof friendCodes>;
export type FriendBucketAssignmentRow = InferSelectModel<typeof friendBucketAssignments>;
export type NewFriendBucketAssignment = InferInsertModel<typeof friendBucketAssignments>;
