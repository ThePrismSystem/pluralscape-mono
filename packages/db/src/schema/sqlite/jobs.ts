import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { JOB_STATUSES, JOB_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { JobStatus, JobType } from "@pluralscape/types";

const DEFAULT_MAX_ATTEMPTS = 5;

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    systemId: text("system_id").references(() => systems.id, { onDelete: "cascade" }),
    type: text("type").notNull().$type<JobType>(),
    payload: sqliteJson("payload").notNull(),
    status: text("status").notNull().default("pending").$type<JobStatus>(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(DEFAULT_MAX_ATTEMPTS),
    nextRetryAt: sqliteTimestamp("next_retry_at"),
    error: text("error"),
    createdAt: sqliteTimestamp("created_at").notNull(),
    startedAt: sqliteTimestamp("started_at"),
    completedAt: sqliteTimestamp("completed_at"),
    idempotencyKey: text("idempotency_key"),
  },
  (t) => [
    index("jobs_status_next_retry_at_idx").on(t.status, t.nextRetryAt),
    index("jobs_type_idx").on(t.type),
    uniqueIndex("jobs_idempotency_key_idx").on(t.idempotencyKey),
    check("jobs_status_check", enumCheck(t.status, [...JOB_STATUSES])),
    check("jobs_type_check", enumCheck(t.type, [...JOB_TYPES])),
  ],
);
