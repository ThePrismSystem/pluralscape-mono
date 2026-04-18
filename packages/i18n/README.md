# @pluralscape/i18n

Internationalization and community-terminology resolution for the Pluralscape platform.

## Overview

This package wraps [i18next](https://www.i18next.com/) with Pluralscape-specific defaults: namespace
layout, missing-key handling, and synchronous React initialization via `I18nProvider`. Consumers
create an instance with `createI18nInstance`, add any additional plugins, and call `.init()` with
locale resources — the factory keeps the instance uninitialized so each application layer can
compose plugins in the right order.

A core concern of this package is the **nomenclature system**: plural systems use widely different
terms for shared concepts (e.g., "headmate", "alter", "part", "insider"). Rather than hardcoding
any one vocabulary, every community term is represented as a `CanonicalTerm` resolved against the
system's `NomenclatureSettings` at display time. Consumers call `resolveTerm` and its variants
(`resolveTermPlural`, `resolveTermLower`, `resolveTermTitle`, `resolveTermUpper`) to get the
user-preferred word in the right grammatical form.

RTL layout is supported via `getTextDirection` / `isRtl`, which map a locale tag to `"ltr"` or
`"rtl"`. RTL locales are declared in `RTL_LOCALES`. Supported locales are declared in
`SUPPORTED_LOCALES`; additional locales are added there alongside translation resource bundles.

## Key Exports

### Instance creation

| Export                         | Description                                                         |
| ------------------------------ | ------------------------------------------------------------------- |
| `createI18nInstance(options?)` | Creates an uninitialized i18next instance with Pluralscape defaults |
| `CreateI18nOptions`            | `{ missingKeyMode: "warn" \| "throw", logger? }`                    |
| `createMissingKeyHandler`      | Builds the missing-key callback used internally by the instance     |

### Constants

| Export              | Description                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DEFAULT_LOCALE`    | `"en"`                                                                                                                             |
| `DEFAULT_NAMESPACE` | `"common"`                                                                                                                         |
| `NAMESPACES`        | All translation namespaces: `common`, `auth`, `members`, `fronting`, `settings`, `communication`, `groups`, `privacy`, `structure` |
| `SUPPORTED_LOCALES` | All supported locale tags                                                                                                          |
| `RTL_LOCALES`       | Locales rendered right-to-left: `ar`, `he`, `fa`, `ur`                                                                             |

### Nomenclature resolvers

All resolvers accept a `CanonicalTerm` and `NomenclatureSettings | null | undefined`.
When settings are absent or the category is unset, the term's `defaultValue` is used.

| Export                                   | Description                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `CANONICAL_TERMS`                        | Map of `SCREAMING_SNAKE` keys to `CanonicalTerm` objects (e.g., `CANONICAL_TERMS.MEMBER`) |
| `PRESET_PLURAL_RULES`                    | Explicit singular-to-plural map for all built-in term values                              |
| `resolveTerm(canonical, settings)`       | Display string (user-preferred or default)                                                |
| `resolveTermPlural(canonical, settings)` | Pluralized form, with heuristic fallback                                                  |
| `resolveTermLower(canonical, settings)`  | Lowercase form                                                                            |
| `resolveTermTitle(canonical, settings)`  | Title-case form                                                                           |
| `resolveTermUpper(canonical, settings)`  | Uppercase form                                                                            |
| `UseNomenclatureResult`                  | Return shape for the nomenclature React hook                                              |

### Text direction

| Export                     | Description                           |
| -------------------------- | ------------------------------------- |
| `isRtl(locale)`            | `true` if the locale is right-to-left |
| `getTextDirection(locale)` | `"ltr"` or `"rtl"`                    |

### Types

| Export                 | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `I18nConfig`           | Full configuration shape passed to `I18nProvider` |
| `I18nNamespace`        | Union of valid namespace strings                  |
| `TranslationResources` | Resource bundle type for `.init()`                |

### React integration (`@pluralscape/i18n/react`)

| Export                  | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `I18nProvider`          | Initializes i18n synchronously and provides it to the React tree |
| `useTranslation`        | Re-export from `react-i18next`                                   |
| `Trans`                 | Re-export from `react-i18next`                                   |
| `UseNomenclatureResult` | Re-export from the core package                                  |

## Usage

### Creating an instance (non-React)

```ts
import { createI18nInstance, NAMESPACES, DEFAULT_NAMESPACE } from "@pluralscape/i18n";

const i18n = createI18nInstance({ missingKeyMode: "throw" });
// Add plugins here, then initialize:
await i18n.init({
  lng: "en",
  resources: { en: { common: { greeting: "Hello" } } },
  defaultNS: DEFAULT_NAMESPACE,
  ns: [...NAMESPACES],
  interpolation: { escapeValue: false },
});
```

### React provider

```tsx
import { I18nProvider } from "@pluralscape/i18n/react";
import type { I18nConfig } from "@pluralscape/i18n";

const config: I18nConfig = {
  locale: "en",
  fallbackLocale: "en",
  missingKeyMode: "warn",
  logger: console,
  resources: { en: { common: { greeting: "Hello" } } },
};

export function App() {
  return (
    <I18nProvider config={config}>
      <Screen />
    </I18nProvider>
  );
}
```

### Nomenclature resolution

```ts
import { CANONICAL_TERMS, resolveTerm, resolveTermPlural } from "@pluralscape/i18n";

// settings comes from the system's stored NomenclatureSettings
const label = resolveTerm(CANONICAL_TERMS.MEMBER, settings); // "Headmate"
const plural = resolveTermPlural(CANONICAL_TERMS.MEMBER, settings); // "Headmates"
```

### Text direction

```ts
import { getTextDirection } from "@pluralscape/i18n";

const dir = getTextDirection("ar"); // "rtl"
```

### Formatting utilities

```ts
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatDuration,
  formatFrontingDuration,
  formatNumber,
  formatCompactNumber,
  formatPercentage,
  formatRelativeTime,
} from "@pluralscape/i18n";

formatDuration(5_400_000); // "1h 30m"
formatFrontingDuration(startMs, null, now); // ongoing front duration
formatRelativeTime(timestamp, "en");
```

## Dependencies

| Package              | Role                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `i18next`            | Core i18n engine                                                   |
| `react-i18next`      | React bindings and `I18nextProvider`                               |
| `@pluralscape/types` | `CanonicalTerm`, `NomenclatureSettings`, `Locale`, `TextDirection` |

## Testing

Unit tests only (no I/O):

```sh
pnpm vitest run --project i18n
```

## Runtime loading (mobile)

See [ADR 035](../../docs/adr/035-i18n-ota-delivery.md) for the OTA delivery
architecture. The chained-backend resolution order — fresh OTA cache →
OTA network → stale OTA cache → bundled baseline — is documented both
there and in-code at `apps/mobile/src/i18n/chained-backend.ts`
(`resolveNamespace`).

## Adding a new locale

1. Add the locale tag to `SUPPORTED_LOCALES` in `i18n.constants.ts`.
2. Add the locale to `BUNDLED_LOCALES` in `apps/mobile/locales/index.ts`.
3. Generate baseline translations via the local subagent (invoke `/translate-locale <locale>`).
4. Update `crowdin.yml` language mapping if Crowdin's locale tag differs.
5. Verify with `pnpm vitest run --project i18n` and `pnpm vitest run --project mobile`.
