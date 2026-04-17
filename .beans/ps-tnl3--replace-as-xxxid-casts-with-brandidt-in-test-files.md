---
# ps-tnl3
title: Replace as-XxxId casts with brandId<T>() in test files
status: completed
type: task
priority: normal
created_at: 2026-04-16T09:34:35Z
updated_at: 2026-04-17T06:30:25Z
parent: ps-0enb
---

Mechanical replacement of `as XxxId` type casts with `brandId<XxxId>()` in all test files across the monorepo. Deferred from PR #453 review.

## Summary of Changes

- Swept every `as XxxId` branded-ID cast in test files and fixtures under `apps/**/*.test.ts`, `apps/**/*.test.tsx`, `apps/**/__tests__/**/*.{ts,tsx}`, `packages/**/*.test.ts`, `packages/**/__tests__/**/*.ts`, and `apps/api-e2e/src/fixtures/**/*.ts`.
- Replaced 1655 cast sites across 336 files with `brandId<XxxId>(...)` from `@pluralscape/types` (or `../brand-utils.js` for tests inside `packages/types`).
- Added a regression guard test at `packages/types/src/__tests__/brand-id-cast-guard.test.ts` that fails if a new `as XxxId` cast appears in scope. Guard excludes union/intersection casts (`as XxxId | ...`, `as XxxId & ...`) since those represent intentional widening (e.g., `null as ChannelId | null` in test fixtures).
- Added `@types/bun` to `packages/types` devDependencies so the guard can use `node:child_process` and `process.cwd()` for its `git grep` invocation.
- Preserved four union-type casts (`null as ChannelId | null`, `null as CustomFrontId | null`, `null as SystemStructureEntityId | null`, `null as MessageId | null`) in data-transform tests — these widen `null` to include a branded ID and cannot be expressed via `brandId()` alone.
- For three sites that cast `auth.systemId as SystemId` to narrow away a nullable union, introduced a local `AuthContextWithSystem` type on the mock factories in `apps/api/src/__tests__/ws/{bounded-subscribe,graceful-shutdown}.test.ts` so the value is non-nullable at the type level.
- Renamed one test description in `packages/types/src/__tests__/groups.test.ts` that included the literal substring `as GroupId` so the guard's regex no longer trips on it.

## Out of Scope / Flagged

- `apps/api-e2e/src/tests/websocket/sync-ws.spec.ts:71` (`"sys_test" as SystemId`) — an E2E Playwright spec outside the specified glob. Left untouched per instructions; safe to address in a follow-up if desired.
- `packages/sync/src/document-types.ts:154` (`} as ParsedDocumentId;`) — source (non-test) code, intentional widening over an object literal, out of scope.
