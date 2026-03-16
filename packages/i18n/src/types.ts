import type { NAMESPACES } from "./constants.js";

/** A translation namespace name. */
export type I18nNamespace = (typeof NAMESPACES)[number];

/** Resource bundle shape: namespace -> key -> translated string. */
export type TranslationResources = Partial<Record<I18nNamespace, Record<string, string>>>;

/** Configuration for creating an i18n instance. */
export interface I18nConfig {
  /** The locale to use. */
  readonly locale: string;
  /** Fallback locale when a key is missing in the active locale. */
  readonly fallbackLocale: string;
  /** Translation resources keyed by namespace. */
  readonly resources: Record<string, TranslationResources>;
  /** Handler called when a translation key is missing. */
  readonly onMissingKey?: (key: string, namespace: string) => void;
}
