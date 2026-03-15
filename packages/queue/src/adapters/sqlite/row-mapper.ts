import type { JobRow } from "@pluralscape/db/sqlite";
import type { JobDefinition, SystemId, UnixMillis } from "@pluralscape/types";

/**
 * Converts a Drizzle job row into a `JobDefinition`.
 *
 * `sqliteTimestamp` columns store/return plain numbers (UnixMillis passthrough),
 * so the conversion is mostly branded-type casting.
 */
export function rowToJob(row: JobRow): JobDefinition {
  return {
    id: row.id,
    systemId: (row.systemId ?? null) as SystemId | null,
    type: row.type,
    status: row.status,
    payload: (row.payload ?? {}) as Readonly<Record<string, unknown>>,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    nextRetryAt: (row.nextRetryAt ?? null) as UnixMillis | null,
    error: row.error ?? null,
    result: row.result ?? null,
    createdAt: row.createdAt as UnixMillis,
    startedAt: (row.startedAt ?? null) as UnixMillis | null,
    completedAt: (row.completedAt ?? null) as UnixMillis | null,
    idempotencyKey: row.idempotencyKey ?? null,
    lastHeartbeatAt: (row.lastHeartbeatAt ?? null) as UnixMillis | null,
    timeoutMs: row.timeoutMs,
    scheduledFor: (row.scheduledFor ?? null) as UnixMillis | null,
    priority: row.priority,
  };
}
