import { MS_PER_SECOND } from "@pluralscape/types";

export { MS_PER_SECOND };

/** Seconds per minute. */
export const SECONDS_PER_MINUTE = 60;

/** Minutes per hour. */
export const MINUTES_PER_HOUR = 60;

/** Hours per day. */
export const HOURS_PER_DAY = 24;

/** Days per week. */
export const DAYS_PER_WEEK = 7;

/** Average days per month (for relative time approximation). */
export const DAYS_PER_MONTH = 30.44;

/** Average days per year (for relative time approximation). */
export const DAYS_PER_YEAR = 365.25;

/** Milliseconds per minute. */
export const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;

/** Milliseconds per hour. */
export const MS_PER_HOUR = MINUTES_PER_HOUR * MS_PER_MINUTE;

/** Milliseconds per day. */
export const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;

/** Milliseconds per week. */
export const MS_PER_WEEK = DAYS_PER_WEEK * MS_PER_DAY;

/** Milliseconds per month (approximate). */
export const MS_PER_MONTH = DAYS_PER_MONTH * MS_PER_DAY;

/** Milliseconds per year (approximate). */
export const MS_PER_YEAR = DAYS_PER_YEAR * MS_PER_DAY;
