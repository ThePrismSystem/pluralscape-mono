---
# mobile-h89l
title: Hoist i18nConfig singletons out of useMemo
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T18:52:19Z
parent: mobile-e3l7
---

Finding [PERF-3] from audit 2026-04-20. apps/mobile/app/\_layout.tsx:199-212. AsyncStorageI18nCache and createChainedBackend re-created on every locale change. Stateless singletons. Fix: module-level const or ref.

## Summary of Changes

Hoisted the AsyncStorageI18nCache and createChainedBackend constructions out of the locale-keyed useMemo in apps/mobile/app/\_layout.tsx into module-scope constants. They are stateless singletons (the cache closes over AsyncStorage + I18N_CACHE_TTL_MS; the backend closes over apiBaseUrl + loadBundled + the cache) and never needed to re-initialise on locale changes. The i18nConfig useMemo now just swaps the locale and reuses the hoisted backend.

Updated app/**tests**/\_layout.test.tsx to use vi.hoisted for the mocked createChainedBackend stub, since the module-scope call now runs during import rather than during render.
