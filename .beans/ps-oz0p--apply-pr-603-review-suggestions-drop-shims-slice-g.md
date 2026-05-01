---
# ps-oz0p
title: "Apply PR #603 review suggestions: drop shims, slice god-types, fold helpers"
status: completed
type: task
priority: normal
created_at: 2026-05-01T19:06:56Z
updated_at: 2026-05-01T19:26:33Z
---

Apply all suggestions from /review-pr on PR #603 (refactor/tier-b-loc-ratchet-splits). No critical/important issues; all suggestions.

## Tasks

- [x] **Cluster 1 — Sync shim removal**
  - [x] Migrate 11 sync test files + 1 engine module to import per-validator helpers from `validators/<name>.js` (2 `import *` files keep namespace import for vi.spyOn)
  - [x] Delete re-export block at `packages/sync/src/post-merge-validator.ts:38-53`
- [x] **Cluster 2 — Import-core shim removal**
  - [x] Update package barrel to re-export `buildPersistableEntity` from helpers directly
  - [x] Migrate `packages/import-core/src/__tests__/import-engine-parsing.test.ts`
  - [x] (skipped) import-sp test imports from SP-side engine re-export, not core shim — out of scope for this PR
  - [x] Delete re-export at `packages/import-core/src/import-engine.ts` + JSDoc cleanup
  - [x] Update stale JSDoc in `packages/import-core/src/import-engine.helpers.ts`
- [x] **Cluster 3 — Mobile import-sp cleanup** (all done)
- [x] **Verification** — all green
  - [x] Targeted vitest projects: sync 951/951, import-core 124/124, mobile 1366/1366
  - [x] Full suite: format/lint/typecheck pass, unit 13177/13180 (3 pre-existing skips), integration 3032/3043 (11 skips), e2e 509/511 (2 skips)
  - [x] Grep guard clean for all four shim sites

## Summary of Changes

Applied all suggestions from /review-pr on PR #603 (no critical/important; suggestions only). Three commits, one per cluster:

1. **refactor(sync)** — Migrated 11 sync test files + sync-engine consumer to per-validator paths; deleted 16-line re-export block in post-merge-validator.ts. Two import-\* namespace tests retained for vi.spyOn on runAllValidations.
2. **refactor(import-core)** — Routed package barrel directly to import-engine.helpers.js for buildPersistableEntity; migrated import-core test; cleaned stale JSDoc; deleted re-export shim in import-engine.ts. import-sp engine has its own buildPersistableEntity surface (out of scope).
3. **refactor(mobile)** — Sliced TRPCClientSubset per builder via Pick; un-exported Query/Mutation generics; moved AVATAR_ENCRYPTION_TIER to constants; folded 41-LOC trpc-persister-api.helpers.ts (defaultFetch into trpc-persister-api.ts; sha256Hex into blob-and-refs.ts); deleted helpers file; dropped TRPCClientSubset/FetchFn re-export shim and the orphaned import.hooks.ts re-export of useImport\*; migrated index.ts barrel + dynamic test imports.

Pre-production policy enforced everywhere: no aliases, shims, or re-exports left behind.
