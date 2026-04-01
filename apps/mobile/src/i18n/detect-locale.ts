import { DEFAULT_LOCALE } from "@pluralscape/i18n";
import { getLocales } from "expo-localization";

export function detectLocale(supportedLocales: readonly string[]): string {
  const deviceLocales = getLocales();
  const supported = new Set(supportedLocales);
  for (const { languageTag, languageCode } of deviceLocales) {
    if (supported.has(languageTag)) return languageTag;
    if (languageCode && supported.has(languageCode)) return languageCode;
  }
  return DEFAULT_LOCALE;
}
