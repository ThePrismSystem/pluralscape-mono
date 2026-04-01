import { DEFAULT_LOCALE } from "@pluralscape/i18n";
import { getLocales } from "expo-localization";

import type { Locale } from "@pluralscape/types";

export function detectLocale(supportedLocales: readonly Locale[]): Locale {
  const deviceLocales = getLocales();
  const supported = new Set<string>(supportedLocales);
  for (const { languageTag, languageCode } of deviceLocales) {
    if (supported.has(languageTag)) return languageTag as Locale;
    if (languageCode && supported.has(languageCode)) return languageCode as Locale;
  }
  return DEFAULT_LOCALE;
}
