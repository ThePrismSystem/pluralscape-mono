import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, unique, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/constants.js";
import { BUCKET_CONTENT_ENTITY_TYPES, FRIEND_CONNECTION_STATUSES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { BucketContentEntityType, FriendConnectionStatus } from "@pluralscape/types";

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
  },
  (t) => [
    index("buckets_system_id_idx").on(t.systemId),
    unique("buckets_id_system_id_unique").on(t.id, t.systemId),
    versionCheckFor("buckets", t.version),
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
  },
  (t) => [
    primaryKey({ columns: [t.entityType, t.entityId, t.bucketId] }),
    index("bucket_content_tags_bucket_id_idx").on(t.bucketId),
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
    friendSystemId: varchar("friend_system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    encryptedKey: pgBinary("encrypted_key").notNull(),
    keyVersion: integer("key_version").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
    revokedAt: pgTimestamp("revoked_at"),
  },
  (t) => [
    index("key_grants_friend_bucket_idx").on(t.friendSystemId, t.bucketId),
    index("key_grants_friend_revoked_idx").on(t.friendSystemId, t.revokedAt),
    index("key_grants_revoked_at_idx").on(t.revokedAt),
    unique("key_grants_bucket_friend_version_uniq").on(t.bucketId, t.friendSystemId, t.keyVersion),
    check("key_grants_key_version_check", sql`${t.keyVersion} >= 1`),
  ],
);

// Connections are intentionally directional: A→B and B→A are separate entries
export const friendConnections = pgTable(
  "friend_connections",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    friendSystemId: varchar("friend_system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("pending")
      .$type<FriendConnectionStatus>(),
    encryptedData: pgEncryptedBlob("encrypted_data"),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("friend_connections_system_status_idx").on(t.systemId, t.status),
    index("friend_connections_friend_status_idx").on(t.friendSystemId, t.status),
    unique("friend_connections_system_friend_uniq").on(t.systemId, t.friendSystemId),
    unique("friend_connections_id_system_id_unique").on(t.id, t.systemId),
    check("friend_connections_status_check", enumCheck(t.status, FRIEND_CONNECTION_STATUSES)),
    check("friend_connections_no_self_check", sql`${t.systemId} != ${t.friendSystemId}`),
    versionCheckFor("friend_connections", t.version),
  ],
);

export const friendCodes = pgTable(
  "friend_codes",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 255 }).notNull().unique(),
    createdAt: pgTimestamp("created_at").notNull(),
    expiresAt: pgTimestamp("expires_at"),
  },
  (t) => [
    index("friend_codes_system_id_idx").on(t.systemId),
    check(
      "friend_codes_expires_at_check",
      sql`${t.expiresAt} IS NULL OR ${t.expiresAt} > ${t.createdAt}`,
    ),
    check("friend_codes_code_min_length_check", sql`length(${t.code}) >= 8`),
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
  },
  (t) => [
    primaryKey({ columns: [t.friendConnectionId, t.bucketId] }),
    index("friend_bucket_assignments_bucket_id_idx").on(t.bucketId),
  ],
);
