import {
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_MONTH,
  MS_PER_SECOND,
  MS_PER_WEEK,
  MS_PER_YEAR,
} from "./time-constants.js";

import type { Locale } from "@pluralscape/types";

interface TimeUnit {
  readonly unit: Intl.RelativeTimeFormatUnit;
  readonly ms: number;
}

const TIME_UNITS: readonly TimeUnit[] = [
  { unit: "year", ms: MS_PER_YEAR },
  { unit: "month", ms: MS_PER_MONTH },
  { unit: "week", ms: MS_PER_WEEK },
  { unit: "day", ms: MS_PER_DAY },
  { unit: "hour", ms: MS_PER_HOUR },
  { unit: "minute", ms: MS_PER_MINUTE },
  { unit: "second", ms: MS_PER_SECOND },
];

/**
 * Formats a date as a relative time string (e.g. "3 hours ago", "in 2 days").
 *
 * Picks the best unit based on the time delta.
 */
export function formatRelativeTime(date: Date, locale: Locale, now?: Date): string {
  const ref = now ?? new Date();
  const deltaMs = date.getTime() - ref.getTime();
  const absDelta = Math.abs(deltaMs);

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const { unit, ms } of TIME_UNITS) {
    if (absDelta >= ms) {
      const value = Math.round(deltaMs / ms);
      return formatter.format(value, unit);
    }
  }

  // Less than 1 second
  return formatter.format(0, "second");
}
