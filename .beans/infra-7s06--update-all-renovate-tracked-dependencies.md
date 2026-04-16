---
# infra-7s06
title: Update all Renovate-tracked dependencies
status: completed
type: task
priority: normal
created_at: 2026-04-10T14:11:35Z
updated_at: 2026-04-16T07:29:54Z
parent: ps-h2gl
---

Update all dependencies from Renovate dashboard issue #203 and incorporate PR #388 docker digest. Run full verification + pnpm audit.

## Summary of Changes

Updated all Renovate-tracked dependencies from issue #203 and incorporated PR #388:

**Runtime deps:** @electric-sql/pglite 0.4.4, bullmq 5.73.3, i18next 26.0.4, libsodium-wrappers-sumo 0.8.3, @aws-sdk/\* 3.1028.0, @tanstack/react-query 5.97.0, react 19.2.5, react-dom 19.2.5, react-native 0.85.0, expo monorepo ~55.x, expo-document-picker v55, @expo/dom-webview 55.0.5

**Dev deps:** vite 8.0.8, turbo 2.9.6, vitest 4.1.4, @vitest/coverage-v8 4.1.4, prettier 3.8.2, knip 6.3.1, @redocly/cli 2.26.0, @types/node latest, typescript-eslint 8.58.1

**CI:** postgres:18 docker digest updated (from PR #388)

**Fixes applied:**

- Added `@tanstack/query-core: 5.97.0` pnpm override to deduplicate query-core versions (prevents #private field type mismatch between 5.96.x and 5.97.0)
- Updated vite override from 8.0.5 to 8.0.8
- Fixed pre-existing E2E test: lifecycle.spec.ts sent empty selectedCategories
- Fixed pre-existing E2E test: audit_log CHECK constraint missing import-job.completed/failed
- Removed orphan migration 0003_many_adam_warlock.sql

**Verification:** typecheck, lint, format, unit (826 files/11403 tests), integration (125 files/2651 tests), E2E (473 tests), pnpm audit — all pass
