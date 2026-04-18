import type { Brand } from "./ids.js";

/**
 * All locales the application supports.
 *
 * A new locale is added in two places: this tuple (the type-level source of
 * truth) and `apps/mobile/locales/index.ts`'s `BUNDLED_LOCALES` (the bundled
 * translation fallback for offline launches). Keep the two in sync — the
 * bundled-locales test asserts equality at build time.
 */
export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "es-419",
  "fr",
  "de",
  "it",
  "pt-BR",
  "ru",
  "nl",
  "zh-Hans",
  "ja",
  "ko",
  "ar",
] as const;

/** The locale identifier type — one of the supported codes. */
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** A namespaced translation key (e.g. "settings.theme.dark"). */
export type TranslationKey = Brand<string, "TranslationKey">;

/** A mapping from translation keys to localized strings. */
export type TranslationMap = Readonly<Record<TranslationKey, string>>;

/** Text direction for a locale. */
export type TextDirection = "ltr" | "rtl";

/** User preference for date formatting. */
export type DateFormatPreference = "iso" | "us" | "eu" | "relative";

/** User preference for number formatting. */
export type NumberFormatPreference = "system" | "locale";

/** Full locale configuration for a user. */
export interface LocaleConfig {
  readonly locale: Locale;
  readonly fallbackLocale: Locale;
  readonly textDirection: TextDirection;
  readonly dateFormat: DateFormatPreference;
  readonly numberFormat: NumberFormatPreference;
}
