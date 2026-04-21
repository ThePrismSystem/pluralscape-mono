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
`SUPPORTED_LOCALES` (re-exported from `@pluralscape/types`, the single source of truth); additional
locales are added there alongside translation resource bundles.

Pluralscape ships 13 locales: `en`, `es`, `es-419`, `fr`, `de`, `it`, `pt-BR`, `ru`, `nl`,
`zh-Hans`, `ja`, `ko`, and `ar`. English is the source language; the other 12 are translated via
Crowdin and delivered over-the-air. Arabic is the only RTL locale currently shipped — `he`, `fa`,
and `ur` remain in `RTL_LOCALES` so device-detected fallbacks render correctly even though they are
not translated yet.

## Key Exports

### Instance creation

| Export                         | Description                                                         |
| ------------------------------ | ------------------------------------------------------------------- |
| `createI18nInstance(options?)` | Creates an uninitialized i18next instance with Pluralscape defaults |
| `CreateI18nOptions`            | `{ missingKeyMode: "warn" \| "throw", logger?, backend? }`          |
| `createMissingKeyHandler`      | Builds the missing-key callback used internally by the instance     |

The optional `backend` plugin is registered on the instance before initialization — the mobile app
passes its chained OTA→cache→bundled backend here (see "Runtime loading" below).

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

Translations reach the app through three layers — bundled baseline, cached OTA, and live OTA —
composed behind a single i18next backend.

### Crowdin OTA proxy

The API exposes a read-only proxy in front of the Crowdin distribution CDN (see
[ADR 035](../../docs/adr/035-i18n-ota-delivery.md) and
[ADR 036](../../docs/adr/036-crowdin-automation.md)):

- `GET /v1/i18n/manifest` — current distribution manifest (`I18nManifest`).
- `GET /v1/i18n/:locale/:namespace` — one namespace of translations for a locale.

Both responses are cached in Valkey with `I18N_CACHE_TTL_MS` (24 hours). Namespace responses carry
a strong `ETag` derived from the translations body plus `Cache-Control: public, max-age=0,
must-revalidate`; requests with a matching `If-None-Match` short-circuit to `304 Not Modified`
(RFC 7232 §4.1) with no body. Upstream 404 surfaces as `NAMESPACE_NOT_FOUND` (404); timeout,
malformed response, or other upstream failure surfaces as `UPSTREAM_UNAVAILABLE` (502). The
route rate-limits under the `i18nFetch` category. Locale and namespace URL segments are validated
against the shared `LocaleSchema` / `NamespaceSchema` to block path traversal into the Crowdin CDN.

### Chained backend

The mobile app's i18next backend at `apps/mobile/src/i18n/chained-backend.ts` resolves each
`(locale, namespace)` in this order (`resolveNamespace`):

1. **Fresh OTA cache** — AsyncStorage entry within TTL.
2. **OTA network** — request the proxy with `If-None-Match`; `304` refreshes `fetchedAt`, `200`
   rewrites the cache entry with the new etag and body.
3. **Stale OTA cache** — on network failure, serve the previous entry regardless of TTL.
4. **Bundled baseline** — `loadBundled()` from `apps/mobile/locales/index.ts`.

### Bundled baseline and Metro code-splitting

`apps/mobile/locales/index.ts` loads each namespace via a dynamic `import()` with a literal-prefix
template (`./${locale}/${namespace}.json`). Metro code-splits the JSON into per-chunk bundles so
only the active locale's namespaces are parsed at runtime. `BUNDLED_NAMESPACES` is intentionally a
subset of `NAMESPACES` — the core user-facing set (`common`, `auth`, `fronting`, `members`,
`settings`) — keeping the shipped binary small while still giving every locale an offline-first
fallback.

### Crowdin integration

`crowdin.yml` configures the daily sync workflow. Two non-obvious details:

- `languages_mapping.locale` keys are **Crowdin language IDs**, not locale values. Without the
  mapping, the default `%locale%` expansion writes to directories like `ar-SA/` or `de-DE/` that
  the loader does not read. The mapping normalises every target onto the short-code directory
  layout under `apps/mobile/locales/`.
- `.context.json` sidecars alongside source files are excluded — they feed the
  `crowdin-upload-context` step and must not be ingested as source strings.

## Adding a new locale

1. Add the locale tag to `SUPPORTED_LOCALES` in `packages/types/src/i18n.ts` (the canonical
   declaration — `packages/i18n/src/i18n.constants.ts` re-exports it).
2. Add the locale to `BUNDLED_LOCALES` in `apps/mobile/locales/index.ts` (a test asserts the two
   lists stay in sync).
3. Generate baseline translations via the local subagent (invoke `/translate-locale <locale>`).
4. Update `crowdin.yml` `languages_mapping` if Crowdin's language ID differs from the short code.
5. Verify with `pnpm vitest run --project i18n` and `pnpm vitest run --project mobile`.
