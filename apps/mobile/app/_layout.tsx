import { I18nProvider } from "@pluralscape/i18n/react";
import { Stack } from "expo-router";

import { resources } from "../locales";

export default function RootLayout(): React.JSX.Element {
  return (
    <I18nProvider
      config={{
        locale: "en",
        fallbackLocale: "en",
        resources,
      }}
    >
      <Stack />
    </I18nProvider>
  );
}
