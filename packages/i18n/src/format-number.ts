import type { Locale, NumberFormatPreference } from "@pluralscape/types";

/** Formats a number according to the user's preference and locale. */
export function formatNumber(value: number, locale: Locale, pref: NumberFormatPreference): string {
  if (pref === "system") {
    // Intentionally uses the runtime locale (OS/browser setting), ignoring the
    // explicit `locale` param — this is the "system default" user preference.
    return value.toLocaleString();
  }
  return new Intl.NumberFormat(locale).format(value);
}

/** Formats a number in compact notation (e.g. 1.2K, 3.4M). */
export function formatCompactNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { notation: "compact" }).format(value);
}

/** Formats a number as a percentage. */
export function formatPercentage(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}
