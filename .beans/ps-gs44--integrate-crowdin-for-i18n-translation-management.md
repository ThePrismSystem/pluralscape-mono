---
# ps-gs44
title: Integrate Crowdin for i18n translation management
status: completed
type: task
priority: normal
created_at: 2026-04-01T01:29:21Z
updated_at: 2026-04-17T21:50:45Z
parent: ps-0enb
---

Set up Crowdin integration for managing translations. Connect the i18n namespace/resource files to Crowdin for collaborative translation, configure CI sync (push source strings, pull translations), and document the workflow for contributors.

## Summary of Changes

### Shared types & constants

- Added rate-limit category `i18nFetch` (30/min/IP) for the public Crowdin OTA proxy
- New shared types in `@pluralscape/types/i18n`: `I18nManifest`, `I18nLocaleManifest`, `I18nNamespaceManifest`, `I18nNamespace`
- Constants `I18N_CACHE_TTL_MS` (24h), `I18N_OTA_TIMEOUT_MS` (5s), `I18N_ETAG_LENGTH` (16)

### API

- New env var `CROWDIN_DISTRIBUTION_HASH` (required in production)
- Refactored Valkey bootstrap to expose the shared ioredis client beside the rate-limit store
- New generic `ValkeyCache` K/V helper with TTL and JSON round-trip
- New `CrowdinOtaService` with typed `CrowdinOtaUpstreamError` / `CrowdinOtaTimeoutError`
- New deterministic `computeTranslationsEtag` helper
- REST routes `GET /v1/i18n/manifest` and `GET /v1/i18n/:locale/:namespace` with 24h Valkey cache, ETag/304, and lazy dep resolution (503 NOT_CONFIGURED when Valkey/hash unset)
- tRPC procedures `i18n.getManifest` and `i18n.getNamespace` via `publicProcedure` + `i18nFetch` limiter (factory + composer pattern)
- tRPC parity check passes (`pnpm trpc:parity`)
- OpenAPI spec updated with `/v1/i18n/*` paths and schemas; modular split under `docs/openapi/{paths,schemas}/i18n.yaml` with regenerated bundle
- E2E tests covering manifest, rate-limit headers, rate-limit skip paths

### Shared i18n package

- Expanded `SUPPORTED_LOCALES` to 12 entries (en + es, es-419, fr, de, it, pt-BR, ru, nl, zh-Hans, ja, ko)
- `createI18nInstance` and `I18nProvider` now accept a custom `BackendModule` plugin

### Mobile

- Added deps: `i18next-chained-backend`, `i18next-http-backend`, `@react-native-async-storage/async-storage`
- New `AsyncStorageI18nCache` (7-day TTL, ETag persistence)
- New `createChainedBackend` composing bundled baseline + OTA overlay with `If-None-Match` support
- `apps/mobile/locales/index.ts` refactored to `loadBundledNamespace()` with dynamic imports so Metro code-splits per locale
- `BUNDLED_LOCALES` (12) and `BUNDLED_NAMESPACES` exported for code-splitting diagnostics
- `_layout.tsx` wires the chained backend into `I18nProvider` via `useMemo`
- Baseline translations for 11 non-English locales committed (`common.json` translated; `auth`/`fronting`/`members`/`settings` empty stubs awaiting UI)

### Local-only subagent & skill (gitignored)

- `.claude/agents/pluralscape-translator.md` with plurality-affirming terminology, JSON structure rules, per-locale style guidance
- `.claude/skills/translate-locale.md` dispatches the subagent per locale

### CI & Crowdin

- `crowdin.yml` at repo root mapping `apps/mobile/locales/en/**/*.json` to `%locale%/%original_file_name%`
- `.github/workflows/crowdin-sync.yml` with merge-time source push + Monday 06:00 UTC translation pull PR

### Docs

- ADR-035 documents the OTA-via-proxy decision (numbered 035 because 033/034 were already taken)
- `CONTRIBUTING.md` gains a "Translations" section (workflow, new-locale process, runtime delivery pointer)
- `packages/i18n/README.md` gains "Runtime loading (mobile)" and "Adding a new locale" sections
