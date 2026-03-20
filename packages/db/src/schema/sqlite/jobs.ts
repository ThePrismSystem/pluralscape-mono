import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { JOB_STATUSES, JOB_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { JobId, JobResult, JobStatus, JobType } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

const DEFAULT_MAX_ATTEMPTS = 5;
/**
 * Conservative baseline timeout; job types with long-running work should override per-job.
 * Matches DEFAULT_TIMEOUT_MS in @pluralscape/queue (not imported to avoid circular dependency).
 */
const DEFAULT_TIMEOUT_MS = 30_000;

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey().$type<JobId>(),
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
    /** JSON-serialized result; branded types (e.g. UnixMillis) lose their brand on round-trip. */
    result: sqliteJson("result").$type<JobResult | null>(),
    scheduledFor: sqliteTimestamp("scheduled_for"),
    /** Lower value = higher priority (0 is highest). Matches BullMQ convention. */
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

export type JobRow = InferSelectModel<typeof jobs>;
export type NewJob = InferInsertModel<typeof jobs>;
