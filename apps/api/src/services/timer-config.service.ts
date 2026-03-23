import { checkInRecords, timerConfigs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CreateTimerConfigBodySchema,
  TimerConfigQuerySchema,
  UpdateTimerConfigBodySchema,
} from "@pluralscape/validation";
import { and, count, desc, eq, lt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  PaginatedResult,
  SystemId,
  TimerId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────

interface TimerConfigBase {
  readonly id: TimerId;
  readonly systemId: SystemId;
  readonly enabled: boolean;
  readonly intervalMinutes: number | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export type TimerConfigResult = TimerConfigBase &
  (
    | {
        readonly wakingHoursOnly: true;
        readonly wakingStart: string;
        readonly wakingEnd: string;
      }
    | {
        readonly wakingHoursOnly: false | null;
        readonly wakingStart: string | null;
        readonly wakingEnd: string | null;
      }
  );

export interface TimerConfigListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────

function toTimerConfigResult(row: {
  id: string;
  systemId: string;
  enabled: boolean;
  intervalMinutes: number | null;
  wakingHoursOnly: boolean | null;
  wakingStart: string | null;
  wakingEnd: string | null;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): TimerConfigResult {
  const base: TimerConfigBase = {
    id: row.id as TimerId,
    systemId: row.systemId as SystemId,
    enabled: row.enabled,
    intervalMinutes: row.intervalMinutes,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };

  if (row.wakingHoursOnly === true && row.wakingStart !== null && row.wakingEnd !== null) {
    return {
      ...base,
      wakingHoursOnly: true,
      wakingStart: row.wakingStart,
      wakingEnd: row.wakingEnd,
    };
  }

  return {
    ...base,
    wakingHoursOnly: row.wakingHoursOnly === true ? false : row.wakingHoursOnly,
    wakingStart: row.wakingStart,
    wakingEnd: row.wakingEnd,
  };
}

// ── CREATE ──────────────────────────────────────────────────────

export async function createTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<TimerConfigResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateTimerConfigBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timerId = createId(ID_PREFIXES.timer);
  const timestamp = now();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(timerConfigs)
      .values({
        id: timerId,
        systemId,
        enabled: parsed.enabled ?? true,
        intervalMinutes: parsed.intervalMinutes ?? null,
        wakingHoursOnly: parsed.wakingHoursOnly ?? null,
        wakingStart: parsed.wakingStart ?? null,
        wakingEnd: parsed.wakingEnd ?? null,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create timer config — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "timer-config.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Timer config created",
      systemId,
    });

    return toTimerConfigResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────

export async function listTimerConfigs(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: TimerConfigListOptions = {},
): Promise<PaginatedResult<TimerConfigResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  const conditions = [eq(timerConfigs.systemId, systemId)];

  if (!opts.includeArchived) {
    conditions.push(eq(timerConfigs.archived, false));
  }

  if (opts.cursor) {
    conditions.push(lt(timerConfigs.id, opts.cursor));
  }

  const rows = await db
    .select()
    .from(timerConfigs)
    .where(and(...conditions))
    .orderBy(desc(timerConfigs.id))
    .limit(effectiveLimit + 1);

  return buildPaginatedResult(rows, effectiveLimit, toTimerConfigResult);
}

// ── GET ─────────────────────────────────────────────────────────

export async function getTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  auth: AuthContext,
): Promise<TimerConfigResult> {
  assertSystemOwnership(systemId, auth);

  const [row] = await db
    .select()
    .from(timerConfigs)
    .where(
      and(
        eq(timerConfigs.id, timerId),
        eq(timerConfigs.systemId, systemId),
        eq(timerConfigs.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Timer config not found");
  }

  return toTimerConfigResult(row);
}

// ── UPDATE ──────────────────────────────────────────────────────

export async function updateTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<TimerConfigResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateTimerConfigBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return db.transaction(async (tx) => {
    const setClause: Partial<typeof timerConfigs.$inferInsert> = {
      encryptedData: blob,
      updatedAt: timestamp,
    };

    if (parsed.enabled !== undefined) {
      setClause.enabled = parsed.enabled;
    }
    if (parsed.intervalMinutes !== undefined) {
      setClause.intervalMinutes = parsed.intervalMinutes;
    }
    if (parsed.wakingHoursOnly !== undefined) {
      setClause.wakingHoursOnly = parsed.wakingHoursOnly;
    }
    if (parsed.wakingStart !== undefined) {
      setClause.wakingStart = parsed.wakingStart;
    }
    if (parsed.wakingEnd !== undefined) {
      setClause.wakingEnd = parsed.wakingEnd;
    }

    // The `.set()` object uses `as Record<string, unknown>` to satisfy Drizzle's
    // generic table types when mixing typed columns with sql`...` expressions.
    const updated = await tx
      .update(timerConfigs)
      .set({
        ...setClause,
        version: sql`${timerConfigs.version} + 1`,
      } as Record<string, unknown>)
      .where(
        and(
          eq(timerConfigs.id, timerId),
          eq(timerConfigs.systemId, systemId),
          eq(timerConfigs.version, version),
          eq(timerConfigs.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: timerConfigs.id })
          .from(timerConfigs)
          .where(
            and(
              eq(timerConfigs.id, timerId),
              eq(timerConfigs.systemId, systemId),
              eq(timerConfigs.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Timer config",
    );

    await audit(tx, {
      eventType: "timer-config.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Timer config updated",
      systemId,
    });

    return toTimerConfigResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────

export async function deleteTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: timerConfigs.id })
      .from(timerConfigs)
      .where(
        and(
          eq(timerConfigs.id, timerId),
          eq(timerConfigs.systemId, systemId),
          eq(timerConfigs.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Timer config not found");
    }

    // Check for non-archived dependent check-in records
    const [recordCount] = await tx
      .select({ count: count() })
      .from(checkInRecords)
      .where(and(eq(checkInRecords.timerConfigId, timerId), eq(checkInRecords.archived, false)));

    if (!recordCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    if (recordCount.count > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `Timer config has ${String(recordCount.count)} non-archived check-in record(s). Archive or delete records first.`,
      );
    }

    await tx
      .delete(timerConfigs)
      .where(and(eq(timerConfigs.id, timerId), eq(timerConfigs.systemId, systemId)));

    await audit(tx, {
      eventType: "timer-config.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Timer config deleted",
      systemId,
    });
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────

const TIMER_CONFIG_LIFECYCLE = {
  table: timerConfigs,
  columns: timerConfigs,
  entityName: "Timer config",
  archiveEvent: "timer-config.archived" as const,
  restoreEvent: "timer-config.restored" as const,
};

export async function archiveTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, timerId, auth, audit, TIMER_CONFIG_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────

export async function restoreTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<TimerConfigResult> {
  return restoreEntity(db, systemId, timerId, auth, audit, TIMER_CONFIG_LIFECYCLE, (row) =>
    toTimerConfigResult(row as typeof timerConfigs.$inferSelect),
  );
}

// ── PARSE QUERY PARAMS ──────────────────────────────────────────

export function parseTimerConfigQuery(
  query: Record<string, string | undefined>,
): TimerConfigListOptions {
  const result = TimerConfigQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters");
  }
  return result.data;
}
