import type { NAMESPACES } from "./i18n.constants.js";
import type { Locale } from "@pluralscape/types";

/** A translation namespace name. */
export type I18nNamespace = (typeof NAMESPACES)[number];

/** Resource bundle shape: namespace -> key -> translated string. */
export type TranslationResources = Partial<Record<I18nNamespace, Record<string, string>>>;

/** Configuration for creating an i18n instance. */
export interface I18nConfig {
  /** The locale to use. */
  readonly locale: Locale;
  /** Fallback locale when a key is missing in the active locale. */
  readonly fallbackLocale: Locale;
  /** Translation resources keyed by namespace. */
  readonly resources: Record<string, TranslationResources>;
  /** Missing key handling mode. Defaults to "warn". */
  readonly missingKeyMode?: "warn" | "throw";
}
