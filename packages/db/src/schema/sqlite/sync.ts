import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteBinary, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck, nullPairCheck, versionCheck } from "../../helpers/check.js";
import { SYNC_OPERATIONS, SYNC_RESOLUTIONS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { EntityType, SyncOperation, SyncResolution } from "@pluralscape/types";

export const syncDocuments = sqliteTable(
  "sync_documents",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull().$type<EntityType>(),
    entityId: text("entity_id").notNull(),
    automergeHeads: sqliteBinary("automerge_heads"),
    version: integer("version").notNull().default(1),
    createdAt: sqliteTimestamp("created_at").notNull(),
    lastSyncedAt: sqliteTimestamp("last_synced_at"),
  },
  (t) => [
    uniqueIndex("sync_documents_system_id_entity_type_entity_id_idx").on(
      t.systemId,
      t.entityType,
      t.entityId,
    ),
    check("sync_documents_version_check", versionCheck(t.version)),
  ],
);

// UUID PKs don't guarantee insertion order; consider UUIDv7 or autoincrement sequence for replay ordering.
export const syncQueue = sqliteTable(
  "sync_queue",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull().$type<EntityType>(),
    entityId: text("entity_id").notNull(),
    operation: text("operation").notNull().$type<SyncOperation>(),
    changeData: sqliteBinary("change_data").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
    syncedAt: sqliteTimestamp("synced_at"),
  },
  (t) => [
    index("sync_queue_system_id_synced_at_idx").on(t.systemId, t.syncedAt),
    index("sync_queue_system_id_entity_type_entity_id_idx").on(
      t.systemId,
      t.entityType,
      t.entityId,
    ),
    index("sync_queue_unsynced_idx")
      .on(t.systemId)
      .where(sql`synced_at IS NULL`),
    check("sync_queue_operation_check", enumCheck(t.operation, SYNC_OPERATIONS)),
  ],
);

export const syncConflicts = sqliteTable(
  "sync_conflicts",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull().$type<EntityType>(),
    entityId: text("entity_id").notNull(),
    localVersion: integer("local_version").notNull(),
    remoteVersion: integer("remote_version").notNull(),
    resolution: text("resolution").$type<SyncResolution>(),
    createdAt: sqliteTimestamp("created_at").notNull(),
    resolvedAt: sqliteTimestamp("resolved_at"),
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
