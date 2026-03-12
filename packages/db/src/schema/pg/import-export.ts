import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH, MAX_ERROR_LOG_ENTRIES } from "../../helpers/constants.js";
import {
  ACCOUNT_PURGE_STATUSES,
  EXPORT_FORMATS,
  EXPORT_REQUEST_STATUSES,
  IMPORT_JOB_STATUSES,
  IMPORT_SOURCES,
} from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { blobMetadata } from "./blob-metadata.js";
import { systems } from "./systems.js";

import type {
  AccountPurgeStatus,
  ExportFormat,
  ExportRequestStatus,
  ImportJobStatus,
  ImportSource,
} from "@pluralscape/types";

export const importJobs = pgTable(
  "import_jobs",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    source: varchar("source", { length: ENUM_MAX_LENGTH }).notNull().$type<ImportSource>(),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("pending")
      .$type<ImportJobStatus>(),
    progressPercent: integer("progress_percent").notNull().default(0),
    errorLog: jsonb("error_log"),
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
      sql`${t.errorLog} IS NULL OR jsonb_array_length(${t.errorLog}) <= ${MAX_ERROR_LOG_ENTRIES}`,
    ),
  ],
);

export const exportRequests = pgTable(
  "export_requests",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    format: varchar("format", { length: ENUM_MAX_LENGTH }).notNull().$type<ExportFormat>(),
    status: varchar("status", { length: ENUM_MAX_LENGTH })
      .notNull()
      .default("pending")
      .$type<ExportRequestStatus>(),
    // ON DELETE SET NULL can orphan completed exports; app logic must handle expired/orphaned state.
    blobId: varchar("blob_id", { length: ID_MAX_LENGTH }).references(() => blobMetadata.id, {
      onDelete: "set null",
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
  ],
);

// App-level enforcement needed: only one active purge request per account at a time.
export const accountPurgeRequests = pgTable(
  "account_purge_requests",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    accountId: varchar("account_id", { length: ID_MAX_LENGTH })
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
      .where(sql`status IN ('pending', 'confirmed', 'processing')`),
  ],
);
