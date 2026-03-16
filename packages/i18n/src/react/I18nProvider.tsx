import { type ReactNode, useMemo } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";

import { DEFAULT_NAMESPACE, NAMESPACES } from "../constants.js";
import { createI18nInstance } from "../create-i18n.js";

import type { I18nConfig } from "../types.js";

interface I18nProviderProps {
  /** i18n configuration with locale, resources, etc. */
  readonly config: I18nConfig;
  /** Child components. */
  readonly children: ReactNode;
}

/**
 * Initializes an i18n instance synchronously and provides it to the React tree.
 *
 * Creates the instance once per config change, adds initReactI18next, and
 * calls `.init()` with `initAsync: false` so children render immediately.
 */
export function I18nProvider({ config, children }: I18nProviderProps): React.JSX.Element {
  const instance = useMemo(() => {
    const i18n = createI18nInstance({ missingKeyMode: config.missingKeyMode });
    i18n.use(initReactI18next);
    void i18n.init({
      lng: config.locale,
      fallbackLng: config.fallbackLocale,
      resources: config.resources,
      defaultNS: DEFAULT_NAMESPACE,
      ns: [...NAMESPACES],
      interpolation: { escapeValue: false },
      initAsync: false,
    });
    return i18n;
  }, [config.locale, config.fallbackLocale, config.missingKeyMode]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
