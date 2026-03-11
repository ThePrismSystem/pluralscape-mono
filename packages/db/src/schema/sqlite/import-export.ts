import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
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

export const importJobs = sqliteTable(
  "import_jobs",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    source: text("source").notNull().$type<ImportSource>(),
    status: text("status").notNull().default("pending").$type<ImportJobStatus>(),
    progressPercent: integer("progress_percent").notNull().default(0),
    errorLog: sqliteJson("error_log"),
    warningCount: integer("warning_count").notNull().default(0),
    chunksTotal: integer("chunks_total"),
    chunksCompleted: integer("chunks_completed").notNull().default(0),
    createdAt: sqliteTimestamp("created_at").notNull(),
    updatedAt: sqliteTimestamp("updated_at"),
    completedAt: sqliteTimestamp("completed_at"),
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
  ],
);

export const exportRequests = sqliteTable(
  "export_requests",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    format: text("format").notNull().$type<ExportFormat>(),
    status: text("status").notNull().default("pending").$type<ExportRequestStatus>(),
    // ON DELETE SET NULL can orphan completed exports; app logic must handle expired/orphaned state.
    blobId: text("blob_id").references(() => blobMetadata.id, { onDelete: "set null" }),
    createdAt: sqliteTimestamp("created_at").notNull(),
    updatedAt: sqliteTimestamp("updated_at"),
    completedAt: sqliteTimestamp("completed_at"),
  },
  (t) => [
    index("export_requests_account_id_idx").on(t.accountId),
    index("export_requests_system_id_idx").on(t.systemId),
    check("export_requests_format_check", enumCheck(t.format, EXPORT_FORMATS)),
    check("export_requests_status_check", enumCheck(t.status, EXPORT_REQUEST_STATUSES)),
  ],
);

// App-level enforcement needed: only one active purge request per account at a time.
export const accountPurgeRequests = sqliteTable(
  "account_purge_requests",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending").$type<AccountPurgeStatus>(),
    confirmationPhrase: text("confirmation_phrase").notNull(),
    scheduledPurgeAt: sqliteTimestamp("scheduled_purge_at").notNull(),
    requestedAt: sqliteTimestamp("requested_at").notNull(),
    confirmedAt: sqliteTimestamp("confirmed_at"),
    completedAt: sqliteTimestamp("completed_at"),
    cancelledAt: sqliteTimestamp("cancelled_at"),
  },
  (t) => [
    index("account_purge_requests_account_id_idx").on(t.accountId),
    check("account_purge_requests_status_check", enumCheck(t.status, ACCOUNT_PURGE_STATUSES)),
  ],
);
