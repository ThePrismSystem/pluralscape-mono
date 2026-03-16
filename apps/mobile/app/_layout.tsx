import { DEFAULT_LOCALE } from "@pluralscape/i18n";
import { I18nProvider } from "@pluralscape/i18n/react";
import { Stack } from "expo-router";

import { resources } from "../locales";

export default function RootLayout(): React.JSX.Element {
  return (
    <I18nProvider
      config={{
        locale: DEFAULT_LOCALE,
        fallbackLocale: DEFAULT_LOCALE,
        resources,
      }}
    >
      <Stack />
    </I18nProvider>
  );
}
