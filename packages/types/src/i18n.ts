import type { Brand } from "./ids.js";

/** A BCP 47 locale identifier (e.g. "en-US", "ja-JP"). */
export type Locale = Brand<string, "Locale">;

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
