import i18next, { type i18n } from "i18next";

import { DEFAULT_LOCALE, DEFAULT_NAMESPACE, NAMESPACES } from "./constants.js";
import { createMissingKeyHandler } from "./missing-key-handler.js";

export interface CreateI18nOptions {
  /** Missing key handling mode. Defaults to "warn". */
  readonly missingKeyMode?: "warn" | "throw";
}

/**
 * Creates a new i18next instance with Pluralscape defaults.
 *
 * The instance is NOT initialized — the consumer must add plugins
 * (e.g. initReactI18next) and call `.init()` with resources.
 */
export function createI18nInstance(options?: CreateI18nOptions): i18n {
  const instance = i18next.createInstance();
  const mode = options?.missingKeyMode ?? "warn";

  instance.use({
    type: "3rdParty" as const,
    init(i18nInstance: i18n) {
      const handler = createMissingKeyHandler(mode);
      i18nInstance.options.missingKeyHandler = (
        _lngs: readonly string[],
        namespace: string,
        key: string,
      ) => {
        handler(key, namespace);
      };
      i18nInstance.options.fallbackLng = DEFAULT_LOCALE;
      i18nInstance.options.defaultNS = DEFAULT_NAMESPACE;
      i18nInstance.options.ns = [...NAMESPACES];
      i18nInstance.options.interpolation = {
        escapeValue: false,
      };
    },
  });

  return instance;
}
