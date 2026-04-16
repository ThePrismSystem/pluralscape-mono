/**
 * Time and size unit constants.
 *
 * These values are the single source of truth for the numbers defined in
 * docs/planning/api-specification.md. Import them in implementation code
 * rather than hard-coding magic numbers.
 */

// ── Time & size units ────────────────────────────────────────────────

export const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
export const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
export const MS_PER_HOUR = MINUTES_PER_HOUR * MS_PER_MINUTE;
/** Number of milliseconds in one day (24 * 60 * 60 * 1000). */
export const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;

// ── Named duration/size constants ────────────────────────────────────
// Pre-computed to avoid magic-number lint warnings.

/** 5 minutes in milliseconds. */
export const FIVE_MINUTES_MS = 300_000;
/** 7 days in milliseconds. */
export const SEVEN_DAYS_MS = 604_800_000;
/** 30 days in milliseconds. Exceeds 2^31-1 — do NOT pass to `setTimeout`/`setInterval`. */
export const THIRTY_DAYS_MS = 2_592_000_000;
/** 90 days in milliseconds. Exceeds 2^31-1 — do NOT pass to `setTimeout`/`setInterval`. */
export const NINETY_DAYS_MS = 7_776_000_000;

/** 5 MiB in bytes. */
export const FIVE_MiB = 5_242_880;
/** 10 MiB in bytes. */
export const TEN_MiB = 10_485_760;
/** 25 MiB in bytes. */
export const TWENTY_FIVE_MiB = 26_214_400;
/** 500 MiB in bytes. */
export const FIVE_HUNDRED_MiB = 524_288_000;
