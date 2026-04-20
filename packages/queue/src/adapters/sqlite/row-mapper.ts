import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { QueueCorruptionError } from "../../errors.js";
import { PayloadSchemaByType } from "../../payload-schemas.js";

import type { JobRow } from "@pluralscape/db/sqlite";
import type { JobDefinition, SystemId } from "@pluralscape/types";

/**
 * Converts a Drizzle job row into a `JobDefinition`.
 *
 * `sqliteTimestamp` columns store/return plain numbers (UnixMillis passthrough),
 * so the conversion is mostly branded-type casting. The post-validation cast
 * to `JobDefinition` narrows two independently-typed row fields (`type`,
 * `payload`) back into the correlated discriminated union — safe because the
 * preceding zod `safeParse` rejects any mismatched `(type, payload)` pair.
 */
export function rowToJob(row: JobRow): JobDefinition {
  // `row.type` is branded as `JobType` by drizzle, but a corrupted database
  // could surface a literal that is not a known key (e.g. a migration that
  // dropped a type). Use `Object.hasOwn` to narrow the index access so the
  // subsequent safeParse is well-defined.
  if (!Object.hasOwn(PayloadSchemaByType, row.type)) {
    const cause = new Error(`Unknown job type: ${row.type}`);
    throw new QueueCorruptionError(row.id, cause.message, { cause });
  }
  const schema = PayloadSchemaByType[row.type];
  const parsed = schema.safeParse(row.payload);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new QueueCorruptionError(row.id, details, { cause: parsed.error });
  }

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
  } as JobDefinition;
}
