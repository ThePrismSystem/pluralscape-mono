import { checkInRecords, timerConfigs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId } from "@pluralscape/types";
import { and, eq, gte, lte } from "drizzle-orm";

import type { JobHandler } from "@pluralscape/queue";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Minutes per hour, used to compute waking hour boundaries. */
const MINUTES_PER_HOUR = 60;

/** Milliseconds per second. */
const MS_PER_SECOND = 1000;

/**
 * Parse an "HH:MM" string into total minutes since midnight.
 * Returns null if the format is invalid.
 */
export function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = parseInt(match[1] as string, 10);
  const minutes = parseInt(match[2] as string, 10);
  return hours * MINUTES_PER_HOUR + minutes;
}

/**
 * Check if the current time (as minutes since midnight) falls within
 * the waking hours window [wakingStart, wakingEnd).
 */
export function isWithinWakingHours(
  currentMinutes: number,
  wakingStartMinutes: number,
  wakingEndMinutes: number,
): boolean {
  return currentMinutes >= wakingStartMinutes && currentMinutes < wakingEndMinutes;
}

/**
 * Get current minutes since midnight in UTC.
 * Extracted for testability.
 */
export function getCurrentMinutesUtc(nowMs?: number): number {
  const date = nowMs !== undefined ? new Date(nowMs) : new Date();
  return date.getUTCHours() * MINUTES_PER_HOUR + date.getUTCMinutes();
}

/**
 * Compute idempotency key for a timer config + interval window.
 * Uses floor division of the current timestamp by the interval to ensure
 * repeated runs within the same interval produce the same key.
 */
export function computeIdempotencyKey(
  timerConfigId: string,
  intervalMinutes: number,
  nowMs: number,
): string {
  const intervalMs = intervalMinutes * MINUTES_PER_HOUR * MS_PER_SECOND;
  const windowIndex = Math.floor(nowMs / intervalMs);
  return `${timerConfigId}:${String(windowIndex)}`;
}

/** Check if the abort signal has been triggered. */
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

/**
 * Creates a job handler for the `check-in-generate` job type.
 *
 * Polls all enabled, non-archived timer configs and creates check-in
 * records for those whose interval has elapsed. Respects waking hours
 * constraints and uses idempotency keys to prevent duplicate records.
 */
export function createCheckInGenerateHandler(
  db: PostgresJsDatabase,
): JobHandler<"check-in-generate"> {
  return async (_job, ctx) => {
    if (isAborted(ctx.signal)) return;

    const nowMs = Date.now();
    const currentMinutes = getCurrentMinutesUtc(nowMs);

    // Fetch all enabled, non-archived timer configs
    const configs = await db
      .select()
      .from(timerConfigs)
      .where(and(eq(timerConfigs.enabled, true), eq(timerConfigs.archived, false)));

    for (const config of configs) {
      if (isAborted(ctx.signal)) return;

      // Skip configs without an interval
      if (config.intervalMinutes === null) continue;

      // Skip if outside waking hours
      if (config.wakingHoursOnly === true) {
        if (!config.wakingStart || !config.wakingEnd) continue;

        const startMinutes = parseTimeToMinutes(config.wakingStart);
        const endMinutes = parseTimeToMinutes(config.wakingEnd);
        if (startMinutes === null || endMinutes === null) continue;

        if (!isWithinWakingHours(currentMinutes, startMinutes, endMinutes)) continue;
      }

      // Check if a record already exists for this interval window
      const [existing] = await db
        .select({ id: checkInRecords.id })
        .from(checkInRecords)
        .where(
          and(
            eq(checkInRecords.timerConfigId, config.id),
            eq(checkInRecords.systemId, config.systemId),
            gte(
              checkInRecords.scheduledAt,
              nowMs - config.intervalMinutes * MINUTES_PER_HOUR * MS_PER_SECOND,
            ),
            lte(checkInRecords.scheduledAt, nowMs),
          ),
        )
        .limit(1);

      if (existing) continue;

      // Create the check-in record
      const recordId = createId(ID_PREFIXES.checkInRecord);
      await db.insert(checkInRecords).values({
        id: recordId,
        systemId: config.systemId,
        timerConfigId: config.id,
        scheduledAt: nowMs,
      });
    }
  };
}
