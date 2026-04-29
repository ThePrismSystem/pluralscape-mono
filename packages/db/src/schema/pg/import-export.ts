import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { brandedId, pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import {
  ENUM_MAX_LENGTH,
  ID_MAX_LENGTH,
  MAX_ERROR_LOG_ENTRIES,
} from "../../helpers/db.constants.js";
import {
  ACCOUNT_PURGE_STATUSES,
  EXPORT_FORMATS,
  EXPORT_REQUEST_STATUSES,
  IMPORT_ENTITY_TYPES,
  IMPORT_JOB_STATUSES,
  IMPORT_SOURCES,
} from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { blobMetadata } from "./blob-metadata.js";
import { systems } from "./systems.js";

import type {
  AccountId,
  AccountPurgeRequestId,
  AccountPurgeStatus,
  ExportFormat,
  ExportRequestStatus,
  ImportCheckpointState,
  ImportEntityType,
  ImportError,
  ImportJobId,
  ImportJobStatus,
  ImportSourceFormat,
  ServerInternal,
  SystemId,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const importJobs = pgTable(
  "import_jobs",
  {
    id: brandedId<ImportJobId>("id").primaryKey(),
    accountId: brandedId<AccountId>("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: brandedId<SystemId>("system_id").notNull(),
    source: varchar("source", { length: ENUM_MAX_LENGTH }).notNull().$type<ImportSourceFormat>(),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("pending")
      .$type<ImportJobStatus>(),
    progressPercent: integer("progress_percent").notNull().default(0),
    /** Error messages must be sanitized to exclude user-generated content (member names, etc.). */
    errorLog: jsonb("error_log").$type<readonly ImportError[]>(),
    /**
     * Resumption state for interrupted imports. Branded `ServerInternal<…>`
     * so `Serialize<ImportJobServerMetadata>` strips it at the wire boundary
     * — engine-internal scaffolding, not part of the client-visible job.
     */
    checkpointState: jsonb("checkpoint_state").$type<ServerInternal<ImportCheckpointState>>(),
    warningCount: integer("warning_count").notNull().default(0),
    chunksTotal: integer("chunks_total"),
    chunksCompleted: integer("chunks_completed").notNull().default(0),
    createdAt: pgTimestamp("created_at").notNull(),
    updatedAt: pgTimestamp("updated_at").notNull(),
    completedAt: pgTimestamp("completed_at"),
  },
  (t) => [
    index("import_jobs_account_id_status_idx").on(t.accountId, t.status),
    index("import_jobs_system_id_idx").on(t.systemId),
    check("import_jobs_source_check", enumCheck(t.source, IMPORT_SOURCES)),
    check("import_jobs_status_check", enumCheck(t.status, IMPORT_JOB_STATUSES)),
    check(
      "import_jobs_progress_percent_check",
      sql`${t.progressPercent} >= 0 AND ${t.progressPercent} <= 100`,
    ),
    check(
      "import_jobs_chunks_check",
      sql`${t.chunksTotal} IS NULL OR ${t.chunksCompleted} <= ${t.chunksTotal}`,
    ),
    check(
      "import_jobs_error_log_length_check",
      sql`${t.errorLog} IS NULL OR jsonb_array_length(${t.errorLog}) <= ${sql.raw(String(MAX_ERROR_LOG_ENTRIES))}`,
    ),
    foreignKey({
      columns: [t.systemId, t.accountId],
      foreignColumns: [systems.id, systems.accountId],
    }).onDelete("cascade"),
  ],
);

/**
 * Source-entity to target-entity mapping recorded during an import.
 * Enables idempotent re-imports and cross-device dedup.
 *
 * T3 operational metadata. Opaque source IDs contain no identifying user data.
 * RLS: account + system scoped (same pattern as import_jobs).
 */
export const importEntityRefs = pgTable(
  "import_entity_refs",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH }).notNull(),
    source: varchar("source", { length: ENUM_MAX_LENGTH }).notNull().$type<ImportSourceFormat>(),
    sourceEntityType: varchar("source_entity_type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<ImportEntityType>(),
    sourceEntityId: varchar("source_entity_id", { length: 128 }).notNull(),
    pluralscapeEntityId: varchar("pluralscape_entity_id", { length: ID_MAX_LENGTH }).notNull(),
    importedAt: pgTimestamp("imported_at").notNull(),
  },
  (t) => [
    uniqueIndex("import_entity_refs_source_unique_idx").on(
      t.accountId,
      t.systemId,
      t.source,
      t.sourceEntityType,
      t.sourceEntityId,
    ),
    index("import_entity_refs_pluralscape_entity_id_idx").on(t.pluralscapeEntityId),
    index("import_entity_refs_account_system_idx").on(t.accountId, t.systemId),
    check("import_entity_refs_source_check", enumCheck(t.source, IMPORT_SOURCES)),
    check(
      "import_entity_refs_source_entity_type_check",
      enumCheck(t.sourceEntityType, IMPORT_ENTITY_TYPES),
    ),
    foreignKey({
      columns: [t.systemId, t.accountId],
      foreignColumns: [systems.id, systems.accountId],
    }).onDelete("cascade"),
  ],
);

export const exportRequests = pgTable(
  "export_requests",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH }).notNull(),
    format: varchar("format", { length: ENUM_MAX_LENGTH }).notNull().$type<ExportFormat>(),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("pending")
      .$type<ExportRequestStatus>(),
    // ON DELETE RESTRICT: blob must be disassociated or export archived before blob deletion.
    blobId: varchar("blob_id", { length: ID_MAX_LENGTH }).references(() => blobMetadata.id, {
      onDelete: "restrict",
    }),
    createdAt: pgTimestamp("created_at").notNull(),
    updatedAt: pgTimestamp("updated_at").notNull(),
    completedAt: pgTimestamp("completed_at"),
  },
  (t) => [
    index("export_requests_account_id_idx").on(t.accountId),
    index("export_requests_system_id_idx").on(t.systemId),
    check("export_requests_format_check", enumCheck(t.format, EXPORT_FORMATS)),
    check("export_requests_status_check", enumCheck(t.status, EXPORT_REQUEST_STATUSES)),
    foreignKey({
      columns: [t.systemId, t.accountId],
      foreignColumns: [systems.id, systems.accountId],
    }).onDelete("cascade"),
  ],
);

// App-level enforcement needed: only one active purge request per account at a time.
export const accountPurgeRequests = pgTable(
  "account_purge_requests",
  {
    id: brandedId<AccountPurgeRequestId>("id").primaryKey(),
    accountId: brandedId<AccountId>("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("pending")
      .$type<AccountPurgeStatus>(),
    confirmationPhrase: varchar("confirmation_phrase", { length: 255 }).notNull(),
    scheduledPurgeAt: pgTimestamp("scheduled_purge_at").notNull(),
    requestedAt: pgTimestamp("requested_at").notNull(),
    confirmedAt: pgTimestamp("confirmed_at"),
    completedAt: pgTimestamp("completed_at"),
    cancelledAt: pgTimestamp("cancelled_at"),
  },
  (t) => [
    index("account_purge_requests_account_id_idx").on(t.accountId),
    check("account_purge_requests_status_check", enumCheck(t.status, ACCOUNT_PURGE_STATUSES)),
    uniqueIndex("account_purge_requests_active_unique_idx")
      .on(t.accountId)
      .where(sql`${t.status} IN ('pending', 'confirmed', 'processing')`),
  ],
);

export type ImportJobRow = InferSelectModel<typeof importJobs>;
export type NewImportJob = InferInsertModel<typeof importJobs>;
export type ImportEntityRefRow = InferSelectModel<typeof importEntityRefs>;
export type NewImportEntityRef = InferInsertModel<typeof importEntityRefs>;
export type ExportRequestRow = InferSelectModel<typeof exportRequests>;
export type NewExportRequest = InferInsertModel<typeof exportRequests>;
export type AccountPurgeRequestRow = InferSelectModel<typeof accountPurgeRequests>;
export type NewAccountPurgeRequest = InferInsertModel<typeof accountPurgeRequests>;
