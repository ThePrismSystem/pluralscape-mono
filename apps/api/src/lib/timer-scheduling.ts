/** Minutes per hour, used to compute waking hour boundaries. */
const MINUTES_PER_HOUR = 60;

/** Seconds per minute, used to convert interval minutes to milliseconds. */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second. */
const MS_PER_SECOND = 1000;

/**
 * Compute the next check-in time (as UnixMillis) for a timer config.
 *
 * If waking hours are configured, the next check-in is clamped to the start
 * of the waking window when it would otherwise fall outside.
 * Overnight ranges (e.g. 22:00-06:00 where start > end) are handled correctly.
 */
export function computeNextCheckInAt(config: {
  intervalMinutes: number;
  wakingHoursOnly: boolean | null;
  wakingStart: string | null;
  wakingEnd: string | null;
}): number {
  const nowMs = Date.now();
  const intervalMs = config.intervalMinutes * SECONDS_PER_MINUTE * MS_PER_SECOND;
  const nextMs = nowMs + intervalMs;

  if (!config.wakingHoursOnly || !config.wakingStart || !config.wakingEnd) {
    return nextMs;
  }

  const next = new Date(nextMs);
  const nextMinutes = next.getUTCHours() * MINUTES_PER_HOUR + next.getUTCMinutes();
  const [startH, startM] = config.wakingStart.split(":").map(Number) as [number, number];
  const [endH, endM] = config.wakingEnd.split(":").map(Number) as [number, number];
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
