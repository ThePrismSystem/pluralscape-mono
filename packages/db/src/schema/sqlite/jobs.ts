import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { JOB_STATUSES, JOB_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { JobResult, JobStatus, JobType } from "@pluralscape/types";

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_TIMEOUT_MS = 30000;

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
    lastHeartbeatAt: sqliteTimestamp("last_heartbeat_at"),
    timeoutMs: integer("timeout_ms").notNull().default(DEFAULT_TIMEOUT_MS),
    result: sqliteJson("result").$type<JobResult | null>(),
    scheduledFor: sqliteTimestamp("scheduled_for"),
    priority: integer("priority").notNull().default(0),
  },
  (t) => [
    index("jobs_status_next_retry_at_idx").on(t.status, t.nextRetryAt),
    index("jobs_type_idx").on(t.type),
    uniqueIndex("jobs_idempotency_key_idx").on(t.idempotencyKey),
    index("jobs_priority_status_scheduled_idx").on(t.priority, t.status, t.scheduledFor),
    index("jobs_heartbeat_idx").on(t.status, t.lastHeartbeatAt),
    check("jobs_status_check", enumCheck(t.status, [...JOB_STATUSES])),
    check("jobs_type_check", enumCheck(t.type, [...JOB_TYPES])),
    check("jobs_attempts_max_check", sql`${t.attempts} <= ${t.maxAttempts}`),
    check("jobs_timeout_ms_check", sql`${t.timeoutMs} > 0`),
  ],
);
