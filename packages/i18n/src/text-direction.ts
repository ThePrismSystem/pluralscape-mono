import { RTL_LOCALES } from "./i18n.constants.js";

import type { Locale, TextDirection } from "@pluralscape/types";

/**
 * Return whether a BCP 47 tag denotes right-to-left text.
 *
 * Accepts `string` (not `Locale`) so this utility works on any tag we might
 * encounter — device-detected fallbacks, CLDR region variants, and the
 * eventual `Intl.Locale` output — not just the `SUPPORTED_LOCALES` subset.
 * The check is purely prefix-based against `RTL_LOCALES`.
 */
export function isRtl(locale: string): boolean {
  const prefix = locale.split("-")[0]?.toLowerCase() ?? "";
  return (RTL_LOCALES as readonly string[]).includes(prefix);
}

/** Returns the text direction for the given locale. */
export function getTextDirection(locale: Locale): TextDirection {
  return isRtl(locale) ? "rtl" : "ltr";
}
