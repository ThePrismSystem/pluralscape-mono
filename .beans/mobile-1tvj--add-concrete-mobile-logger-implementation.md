---
# mobile-1tvj
title: Add concrete mobile logger implementation
status: todo
type: task
priority: low
created_at: 2026-04-17T23:26:13Z
updated_at: 2026-04-17T23:26:13Z
parent: ps-0enb
---

## Context

`packages/types/src/logger.ts` exports a `Logger` interface (`info`/`warn`/`error` with `Record<string, unknown>` payload), and `apps/api/src/lib/logger.ts` has a concrete Node/Bun implementation. Mobile has no equivalent — `apps/mobile/` uses `globalThis.console.{level}(...)` directly in 7+ files (`bucket-key-provider`, `opfs-sqlite-driver`, `platform/detect`, `expo-secure-token-store`, `_layout.tsx`, and the new i18n chained backend/cache added in PR #465).

## Goal

Provide a concrete `Logger` implementation suitable for React Native + web so mobile code can structure-log instead of raw `console`. Existing call sites migrated to it.

## Todo

- [ ] Design: decide whether to wrap `console` directly or integrate with a library (e.g., `expo-dev-menu` console, OTA-reportable buffer, redaction for sensitive payloads)
- [ ] Implement `createMobileLogger()` in a new `apps/mobile/src/lib/logger.ts` or `packages/logger/` if shared with web
- [ ] Wire it through React context / provider so components can `useLogger()`
- [ ] Migrate the ~7 existing `globalThis.console` call sites to the structured logger
- [ ] Migrate the i18n mobile `console.warn` calls in `chained-backend.ts`, `async-storage-cache.ts`, and `locales/index.ts` (added in PR #465)
- [ ] Document the logger in `apps/mobile/src/lib/README.md` or equivalent
- [ ] Add unit tests with a captured-calls test double

## Notes

Non-urgent — current `globalThis.console` usage is the established pattern and not blocking any feature. This bean exists to track the eventual cleanup and to centralize a proper PII-redaction boundary before we start logging user content (innerworld, member data, etc.).
