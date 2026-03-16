import i18next, { type i18n } from "i18next";

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
      i18nInstance.options.saveMissing = true;
      i18nInstance.options.missingKeyHandler = (
        _lngs: readonly string[],
        namespace: string,
        key: string,
      ) => {
        handler(key, namespace);
      };
    },
  });

  return instance;
}
