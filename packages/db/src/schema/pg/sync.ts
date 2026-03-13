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
import { versionCheckFor } from "../../helpers/audit.pg.js";
import { enumCheck, nullPairCheck } from "../../helpers/check.js";
import {
  ENUM_MAX_LENGTH,
  ID_MAX_LENGTH,
  MAX_AUTOMERGE_HEADS_BYTES,
} from "../../helpers/constants.js";
import { SYNC_OPERATIONS, SYNC_RESOLUTIONS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { EntityType, SyncOperation, SyncResolution } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

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
    versionCheckFor("sync_documents", t.version),
    check(
      "sync_documents_automerge_heads_size_check",
      sql`${t.automergeHeads} IS NULL OR octet_length(${t.automergeHeads}) <= ${MAX_AUTOMERGE_HEADS_BYTES}`,
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
    /** Must always contain encrypted CRDT changesets — never plaintext deltas. */
    encryptedChangeData: pgBinary("encrypted_change_data").notNull(),
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
    // PG: seq is a SERIAL (globally unique auto-increment), so a global unique index suffices.
    // SQLite: seq is application-supplied per system, so uniqueness is (system_id, seq).
    uniqueIndex("sync_queue_seq_idx").on(t.seq),
    index("sync_queue_unsynced_idx")
      .on(t.systemId, t.seq)
      .where(sql`${t.syncedAt} IS NULL`),
    index("sync_queue_cleanup_idx")
      .on(t.syncedAt)
      .where(sql`${t.syncedAt} IS NOT NULL`),
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

export type SyncDocumentRow = InferSelectModel<typeof syncDocuments>;
export type NewSyncDocument = InferInsertModel<typeof syncDocuments>;
export type SyncQueueRow = InferSelectModel<typeof syncQueue>;
export type NewSyncQueue = InferInsertModel<typeof syncQueue>;
export type SyncConflictRow = InferSelectModel<typeof syncConflicts>;
export type NewSyncConflict = InferInsertModel<typeof syncConflicts>;
