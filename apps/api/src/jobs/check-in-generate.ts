import { checkInRecords, timerConfigs } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId } from "@pluralscape/types";
import { parseTimeToMinutes } from "@pluralscape/validation";
import { and, asc, eq, gt } from "drizzle-orm";

import { logger } from "../lib/logger.js";

import { CHECK_IN_GENERATE_BATCH_SIZE } from "./jobs.constants.js";

import type { JobHandler } from "@pluralscape/queue";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Minutes per hour, used to compute waking hour boundaries. */
const MINUTES_PER_HOUR = 60;

/** Seconds per minute, used to convert interval minutes to milliseconds. */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second. */
const MS_PER_SECOND = 1000;

/**
 * Check if the current time (as minutes since midnight) falls within
 * the waking hours window.
 *
 * When `wakingStartMinutes <= wakingEndMinutes`, the window is a
 * daytime range [start, end).
 *
 * When `wakingStartMinutes > wakingEndMinutes`, the window wraps
 * overnight (e.g. 22:00-06:00): time is within range if it is
 * >= start OR < end.
 */
export function isWithinWakingHours(
  currentMinutes: number,
  wakingStartMinutes: number,
  wakingEndMinutes: number,
): boolean {
  if (wakingStartMinutes <= wakingEndMinutes) {
    return currentMinutes >= wakingStartMinutes && currentMinutes < wakingEndMinutes;
  }
  // Overnight range: e.g. 22:00 (1320) to 06:00 (360)
  return currentMinutes >= wakingStartMinutes || currentMinutes < wakingEndMinutes;
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
  const intervalMs = intervalMinutes * SECONDS_PER_MINUTE * MS_PER_SECOND;
  const windowIndex = Math.floor(nowMs / intervalMs);
  return `${timerConfigId}:${String(windowIndex)}`;
}

/** Check if the abort signal has been triggered (avoids lint narrowing). */
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

/**
 * Creates a job handler for the `check-in-generate` job type.
 *
 * Polls enabled, non-archived timer configs in batches and creates check-in
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

    let cursor: string | null = null;
    let errorCount = 0;

    // Process all enabled, non-archived timer configs in paginated batches
    do {
      if (isAborted(ctx.signal)) return;

      const conditions = [eq(timerConfigs.enabled, true), eq(timerConfigs.archived, false)];
      if (cursor !== null) {
        conditions.push(gt(timerConfigs.id, cursor));
      }

      const configs = await db
        .select()
        .from(timerConfigs)
        .where(and(...conditions))
        .orderBy(asc(timerConfigs.id))
        .limit(CHECK_IN_GENERATE_BATCH_SIZE);

      if (configs.length === 0) break;

      for (const config of configs) {
        if (isAborted(ctx.signal)) return;

        await ctx.heartbeat.heartbeat();

        try {
          // Skip configs without an interval
          if (config.intervalMinutes === null) continue;

          // Skip if outside waking hours
          if (config.wakingHoursOnly === true) {
            if (!config.wakingStart || !config.wakingEnd) continue;

            const startMinutes = parseTimeToMinutes(config.wakingStart);
            const endMinutes = parseTimeToMinutes(config.wakingEnd);
            if (startMinutes === null || endMinutes === null) {
              logger.warn("Timer config has unparseable waking time, skipping", {
                timerConfigId: config.id,
                wakingStart: config.wakingStart,
                wakingEnd: config.wakingEnd,
              });
              continue;
            }

            if (!isWithinWakingHours(currentMinutes, startMinutes, endMinutes)) continue;
          }

          // Create the check-in record with idempotency key to prevent duplicates.
          // ON CONFLICT DO NOTHING ensures concurrent runs are safe.
          const recordId = createId(ID_PREFIXES.checkInRecord);
          const idempotencyKey = computeIdempotencyKey(config.id, config.intervalMinutes, nowMs);

          await db
            .insert(checkInRecords)
            .values({
              id: recordId,
              systemId: config.systemId,
              timerConfigId: config.id,
              scheduledAt: nowMs,
              idempotencyKey,
            })
            .onConflictDoNothing();
        } catch (error) {
          errorCount++;
          logger.warn("Failed to process timer config for check-in generation", {
            timerConfigId: config.id,
            ...(error instanceof Error ? { err: error } : { error: String(error) }),
          });
        }
      }

      cursor = configs[configs.length - 1]?.id ?? null;

      // If this batch was smaller than the limit, we've processed all configs
      if (configs.length < CHECK_IN_GENERATE_BATCH_SIZE) break;
    } while (cursor !== null);

    if (errorCount > 0) {
      throw new Error(
        `Check-in generation failed: ${String(errorCount)} config(s) errored during processing`,
      );
    }
  };
}
