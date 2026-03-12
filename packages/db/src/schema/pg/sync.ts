import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { enumCheck, nullPairCheck, versionCheck } from "../../helpers/check.js";
import {
  ENUM_MAX_LENGTH,
  ID_MAX_LENGTH,
  MAX_AUTOMERGE_HEADS_BYTES,
} from "../../helpers/constants.js";
import { SYNC_OPERATIONS, SYNC_RESOLUTIONS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { EntityType, SyncOperation, SyncResolution } from "@pluralscape/types";

export const syncDocuments = pgTable(
  "sync_documents",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: ENUM_MAX_LENGTH }).notNull().$type<EntityType>(),
    entityId: varchar("entity_id", { length: ID_MAX_LENGTH }).notNull(),
    automergeHeads: pgBinary("automerge_heads"),
    version: integer("version").notNull().default(1),
    createdAt: pgTimestamp("created_at").notNull(),
    lastSyncedAt: pgTimestamp("last_synced_at"),
  },
  (t) => [
    uniqueIndex("sync_documents_system_id_entity_type_entity_id_idx").on(
      t.systemId,
      t.entityType,
      t.entityId,
    ),
    check("sync_documents_version_check", versionCheck(t.version)),
    check(
      "sync_documents_automerge_heads_size_check",
      sql`${t.automergeHeads} IS NULL OR octet_length(${t.automergeHeads}) <= ${sql.raw(String(MAX_AUTOMERGE_HEADS_BYTES))}`,
    ),
  ],
);

export const syncQueue = pgTable(
  "sync_queue",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    seq: serial("seq").notNull(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: ENUM_MAX_LENGTH }).notNull().$type<EntityType>(),
    entityId: varchar("entity_id", { length: ID_MAX_LENGTH }).notNull(),
    operation: varchar("operation", { length: ENUM_MAX_LENGTH }).notNull().$type<SyncOperation>(),
    changeData: pgBinary("change_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
    syncedAt: pgTimestamp("synced_at"),
  },
  (t) => [
    index("sync_queue_system_id_synced_at_idx").on(t.systemId, t.syncedAt),
    index("sync_queue_system_id_entity_type_entity_id_idx").on(
      t.systemId,
      t.entityType,
      t.entityId,
    ),
    check("sync_queue_operation_check", enumCheck(t.operation, SYNC_OPERATIONS)),
    uniqueIndex("sync_queue_seq_idx").on(t.seq),
    index("sync_queue_unsynced_idx")
      .on(t.systemId)
      .where(sql`synced_at IS NULL`),
  ],
);

export const syncConflicts = pgTable(
  "sync_conflicts",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: ENUM_MAX_LENGTH }).notNull().$type<EntityType>(),
    entityId: varchar("entity_id", { length: ID_MAX_LENGTH }).notNull(),
    localVersion: integer("local_version").notNull(),
    remoteVersion: integer("remote_version").notNull(),
    resolution: varchar("resolution", { length: ENUM_MAX_LENGTH }).$type<SyncResolution>(),
    createdAt: pgTimestamp("created_at").notNull(),
    resolvedAt: pgTimestamp("resolved_at"),
    details: text("details"),
  },
  (t) => [
    index("sync_conflicts_system_id_entity_type_entity_id_idx").on(
      t.systemId,
      t.entityType,
      t.entityId,
    ),
    check("sync_conflicts_resolution_check", enumCheck(t.resolution, SYNC_RESOLUTIONS)),
    check("sync_conflicts_resolution_resolved_at_check", nullPairCheck(t.resolution, t.resolvedAt)),
  ],
);
