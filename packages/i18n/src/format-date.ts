import { formatRelativeTime } from "./format-relative-time.js";
import { MS_PER_DAY } from "./time-constants.js";

import type { DateFormatPreference, Locale } from "@pluralscape/types";

const RELATIVE_THRESHOLD_DAYS = 7;
const RELATIVE_THRESHOLD_MS = RELATIVE_THRESHOLD_DAYS * MS_PER_DAY;

/** Formats a date according to the user's preference and locale. */
export function formatDate(
  date: Date,
  locale: Locale,
  pref: DateFormatPreference,
  now?: Date,
): string {
  if (pref === "relative") {
    const ref = now ?? new Date();
    const delta = Math.abs(ref.getTime() - date.getTime());
    if (delta < RELATIVE_THRESHOLD_MS) {
      return formatRelativeTime(date, locale, ref);
    }
    // Fall through to locale default for older dates
  }

  if (pref === "iso") {
    const y = String(date.getUTCFullYear());
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (pref === "us") {
    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).format(date);
  }

  if (pref === "eu") {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  // Default: locale-aware
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Formats a time value using the locale's conventions. */
export function formatTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Formats a date and time using the locale's conventions. */
export function formatDateTime(
  date: Date,
  locale: Locale,
  pref: DateFormatPreference,
  now?: Date,
): string {
  // Fixed-format prefs: concatenate with comma (explicitly non-locale-aware)
  if (pref === "iso" || pref === "us" || pref === "eu") {
    const datePart = formatDate(date, locale, pref, now);
    const timePart = formatTime(date, locale);
    return `${datePart}, ${timePart}`;
  }

  // pref === "relative": use relative text for recent dates, Intl for older ones
  const ref = now ?? new Date();
  const delta = Math.abs(ref.getTime() - date.getTime());
  if (delta < RELATIVE_THRESHOLD_MS) {
    const datePart = formatDate(date, locale, pref, now);
    const timePart = formatTime(date, locale);
    return `${datePart}, ${timePart}`;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
