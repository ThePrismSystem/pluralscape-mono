import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { SYNC_OPERATIONS, SYNC_RESOLUTIONS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { EntityType, SyncOperation, SyncResolution } from "@pluralscape/types";

export const syncDocuments = pgTable(
  "sync_documents",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 255 }).notNull().$type<EntityType>(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
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
    check("sync_documents_version_check", sql`${t.version} >= 1`),
  ],
);

// UUID PKs don't guarantee insertion order; consider UUIDv7 or autoincrement sequence for replay ordering.
export const syncQueue = pgTable(
  "sync_queue",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 255 }).notNull().$type<EntityType>(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    operation: varchar("operation", { length: 255 }).notNull().$type<SyncOperation>(),
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
    index("sync_queue_unsynced_idx")
      .on(t.systemId)
      .where(sql`synced_at IS NULL`),
  ],
);

export const syncConflicts = pgTable(
  "sync_conflicts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 255 }).notNull().$type<EntityType>(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    localVersion: integer("local_version").notNull(),
    remoteVersion: integer("remote_version").notNull(),
    resolution: varchar("resolution", { length: 255 }).$type<SyncResolution>(),
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
  ],
);
