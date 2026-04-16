/** Minutes per hour, used to compute waking hour boundaries. */
const MINUTES_PER_HOUR = 60;

/** Seconds per minute, used to convert interval minutes to milliseconds. */
const SECONDS_PER_MINUTE = 60;

import { MS_PER_SECOND } from "@pluralscape/types";

/**
 * Compute the next check-in time (as UnixMillis) for a timer config.
 *
 * If waking hours are configured, the next check-in is clamped to the start
 * of the waking window when it would otherwise fall outside.
 * Overnight ranges (e.g. 22:00-06:00 where start > end) are handled correctly.
 */
export function computeNextCheckInAt(
  config: {
    intervalMinutes: number;
    wakingHoursOnly: boolean | null;
    wakingStart: string | null;
    wakingEnd: string | null;
  },
  nowMs: number,
): number {
  const intervalMs = config.intervalMinutes * SECONDS_PER_MINUTE * MS_PER_SECOND;
  const nextMs = nowMs + intervalMs;

  if (!config.wakingHoursOnly || !config.wakingStart || !config.wakingEnd) {
    return nextMs;
  }

  const next = new Date(nextMs);
  const nextMinutes = next.getUTCHours() * MINUTES_PER_HOUR + next.getUTCMinutes();
  const startParts = config.wakingStart.split(":");
  if (startParts.length !== 2) throw new Error(`Invalid waking time format: ${config.wakingStart}`);
  const startH = Number(startParts[0]);
  const startM = Number(startParts[1]);
  if (Number.isNaN(startH) || Number.isNaN(startM)) {
    throw new Error(`Invalid waking time: ${config.wakingStart}`);
  }
  const endParts = config.wakingEnd.split(":");
  if (endParts.length !== 2) throw new Error(`Invalid waking time format: ${config.wakingEnd}`);
  const endH = Number(endParts[0]);
  const endM = Number(endParts[1]);
  if (Number.isNaN(endH) || Number.isNaN(endM)) {
    throw new Error(`Invalid waking time: ${config.wakingEnd}`);
  }
  const startMinutes = startH * MINUTES_PER_HOUR + startM;
  const endMinutes = endH * MINUTES_PER_HOUR + endM;

  // Handle overnight ranges (e.g. 22:00 - 06:00)
  const inWakingHours =
    startMinutes < endMinutes
      ? nextMinutes >= startMinutes && nextMinutes < endMinutes
      : nextMinutes >= startMinutes || nextMinutes < endMinutes;

  if (!inWakingHours) {
    // Clamp to the start of the next waking window
    next.setUTCHours(startH, startM, 0, 0);
    if (next.getTime() <= nowMs) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.getTime();
  }

  return nextMs;
}
