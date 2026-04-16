import i18next, { type i18n } from "i18next";

import { createMissingKeyHandler } from "./missing-key-handler.js";

import type { I18nConfig } from "./types.js";

export type CreateI18nOptions = Pick<I18nConfig, "missingKeyMode" | "logger">;

/**
 * Creates a new i18next instance with Pluralscape defaults.
 *
 * The instance is NOT initialized — the consumer must add plugins
 * (e.g. initReactI18next) and call `.init()` with resources.
 */
export function createI18nInstance(options?: CreateI18nOptions): i18n {
  const instance = i18next.createInstance();
  const mode = options?.missingKeyMode ?? "throw";

  const logger = options?.logger;
  if (mode === "warn" && !logger) {
    throw new Error("Logger is required when missingKeyMode is 'warn'");
  }

  instance.use({
    type: "3rdParty" as const,
    init(i18nInstance: i18n) {
      const handler =
        mode === "warn" && logger
          ? createMissingKeyHandler("warn", logger)
          : createMissingKeyHandler("throw");
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
