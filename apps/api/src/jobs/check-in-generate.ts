import { checkInRecords, timerConfigs } from "@pluralscape/db/pg";
import { ID_PREFIXES, MS_PER_SECOND, brandId, createId } from "@pluralscape/types";
import { and, asc, eq, gt, isNull, lte } from "drizzle-orm";

import { logger } from "../lib/logger.js";
import { computeNextCheckInAt } from "../lib/timer-scheduling.js";

import { CHECK_IN_GENERATE_BATCH_SIZE } from "./jobs.constants.js";

import type { JobHandler } from "@pluralscape/queue";
import type { CheckInRecordId, SystemId, TimerId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Seconds per minute, used to convert interval minutes to milliseconds. */
const SECONDS_PER_MINUTE = 60;

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
 * records for those whose interval has elapsed. Uses idempotency keys to
 * prevent duplicate records.
 */
export function createCheckInGenerateHandler(
  db: PostgresJsDatabase,
): JobHandler<"check-in-generate"> {
  return async (_job, ctx) => {
    if (isAborted(ctx.signal)) return;

    const nowMs = Date.now();

    let cursor: string | null = null;
    let errorCount = 0;

    // Process all enabled, non-archived timer configs in paginated batches
    do {
      if (isAborted(ctx.signal)) return;

      const conditions = [
        eq(timerConfigs.enabled, true),
        isNull(timerConfigs.archivedAt),
        lte(timerConfigs.nextCheckInAt, nowMs),
      ];
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

          // Create the check-in record with idempotency key to prevent duplicates.
          // ON CONFLICT DO NOTHING ensures concurrent runs are safe.
          const recordId = brandId<CheckInRecordId>(createId(ID_PREFIXES.checkInRecord));
          const idempotencyKey = computeIdempotencyKey(config.id, config.intervalMinutes, nowMs);

          await db
            .insert(checkInRecords)
            .values({
              id: recordId,
              systemId: brandId<SystemId>(config.systemId),
              timerConfigId: brandId<TimerId>(config.id),
              scheduledAt: nowMs,
              idempotencyKey,
            })
            .onConflictDoNothing();

          // Advance nextCheckInAt so this config is not picked up again until due
          await db
            .update(timerConfigs)
            .set({
              nextCheckInAt: computeNextCheckInAt(
                {
                  intervalMinutes: config.intervalMinutes,
                  wakingHoursOnly: config.wakingHoursOnly,
                  wakingStart: config.wakingStart,
                  wakingEnd: config.wakingEnd,
                },
                nowMs,
              ),
            })
            .where(eq(timerConfigs.id, config.id));
        } catch (error: unknown) {
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
