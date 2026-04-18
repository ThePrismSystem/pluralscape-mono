import { DEFAULT_LOCALE } from "@pluralscape/i18n";
import { getLocales } from "expo-localization";

import type { Locale } from "@pluralscape/types";

/**
 * Pick the first supported `Locale` that the device advertises.
 *
 * `expo-localization` returns arbitrary BCP 47 tags (`en-US`, `zh-CN`, …);
 * we narrow down to our supported literal union via `includes()`, which
 * TypeScript treats as a type guard when the needle is widened to `Locale`.
 * Falls back to `DEFAULT_LOCALE` when no device locale matches.
 */
export function detectLocale(supportedLocales: readonly Locale[]): Locale {
  const deviceLocales = getLocales();
  for (const { languageTag, languageCode } of deviceLocales) {
    const matchedTag = matchSupported(languageTag, supportedLocales);
    if (matchedTag !== null) return matchedTag;
    if (languageCode !== null) {
      const matchedCode = matchSupported(languageCode, supportedLocales);
      if (matchedCode !== null) return matchedCode;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Narrow a raw device tag to a supported `Locale` by exact tuple membership.
 * Returns `null` when the tag is not in the supported set.
 */
function matchSupported(tag: string, supported: readonly Locale[]): Locale | null {
  for (const candidate of supported) {
    if (candidate === tag) return candidate;
  }
  return null;
}
