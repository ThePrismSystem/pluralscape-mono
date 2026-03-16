import { type ReactNode, useEffect, useState } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";

import { createI18nInstance } from "../create-i18n.js";

import type { I18nConfig } from "../types.js";
import type { i18n } from "i18next";

interface I18nProviderProps {
  /** i18n configuration with locale, resources, etc. */
  readonly config: I18nConfig;
  /** Child components. */
  readonly children: ReactNode;
}

/**
 * Initializes an i18n instance and provides it to the React tree.
 *
 * Creates the instance once, adds initReactI18next, and calls .init().
 */
export function I18nProvider({ config, children }: I18nProviderProps): React.JSX.Element | null {
  const [instance, setInstance] = useState<i18n | null>(null);

  useEffect(() => {
    const i18nInstance = createI18nInstance({
      missingKeyMode: config.onMissingKey ? "throw" : "warn",
    });

    i18nInstance.use(initReactI18next);

    void i18nInstance
      .init({
        lng: config.locale,
        fallbackLng: config.fallbackLocale,
        resources: config.resources,
        interpolation: { escapeValue: false },
      })
      .then(() => {
        setInstance(i18nInstance);
      });
  }, [config]);

  if (instance === null) {
    return null;
  }

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
