import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import type { JobRow } from "@pluralscape/db/sqlite";
import type { JobDefinition, SystemId } from "@pluralscape/types";

/**
 * Converts a Drizzle job row into a `JobDefinition`.
 *
 * `sqliteTimestamp` columns store/return plain numbers (UnixMillis passthrough),
 * so the conversion is mostly branded-type casting.
 */
export function rowToJob(row: JobRow): JobDefinition {
  return {
    id: row.id,
    systemId: row.systemId ? brandId<SystemId>(row.systemId) : null,
    type: row.type,
    status: row.status,
    payload: row.payload,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    nextRetryAt: toUnixMillisOrNull(row.nextRetryAt ?? null),
    error: row.error ?? null,
    result: row.result ?? null,
    createdAt: toUnixMillis(row.createdAt),
    startedAt: toUnixMillisOrNull(row.startedAt ?? null),
    completedAt: toUnixMillisOrNull(row.completedAt ?? null),
    idempotencyKey: row.idempotencyKey ?? null,
    lastHeartbeatAt: toUnixMillisOrNull(row.lastHeartbeatAt ?? null),
    timeoutMs: row.timeoutMs,
    scheduledFor: toUnixMillisOrNull(row.scheduledFor ?? null),
    priority: row.priority,
  };
}
