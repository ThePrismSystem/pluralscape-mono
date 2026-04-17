import type { NAMESPACES } from "./i18n.constants.js";
import type { Locale, Logger } from "@pluralscape/types";

/** A translation namespace name. */
export type I18nNamespace = (typeof NAMESPACES)[number];

/** Resource bundle shape: namespace -> key -> translated string. */
export type TranslationResources = Partial<Record<I18nNamespace, Record<string, string>>>;

/**
 * Minimal i18next backend plugin interface.
 *
 * Third-party backends (i18next-chained-backend, i18next-http-backend, etc.)
 * conform to this shape. This package does not depend on any specific backend
 * implementation — consumers pass one in via `I18nConfig.backend`.
 */
export interface BackendModule {
  readonly type: "backend";
  read(
    language: string,
    namespace: string,
    callback: (err: Error | null, data: Readonly<Record<string, string>>) => void,
  ): void;
}

/** Configuration for creating an i18n instance. */
export interface I18nConfig {
  /** The locale to use. */
  readonly locale: Locale;
  /** Fallback locale when a key is missing in the active locale. */
  readonly fallbackLocale: Locale;
  /** Translation resources keyed by namespace. */
  readonly resources: Record<string, TranslationResources>;
  /** Missing key handling mode. Defaults to "throw". */
  readonly missingKeyMode?: "warn" | "throw";
  /** Logger for missing key warnings. Only used when missingKeyMode is "warn". */
  readonly logger?: Pick<Logger, "warn">;
  /** Optional i18next backend plugin for loading translations on demand. */
  readonly backend?: BackendModule;
}
