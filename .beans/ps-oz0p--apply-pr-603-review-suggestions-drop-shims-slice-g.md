---
# ps-oz0p
title: "Apply PR #603 review suggestions: drop shims, slice god-types, fold helpers"
status: in-progress
type: task
priority: normal
created_at: 2026-05-01T19:06:56Z
updated_at: 2026-05-01T19:10:27Z
---

Apply all suggestions from /review-pr on PR #603 (refactor/tier-b-loc-ratchet-splits). No critical/important issues; all suggestions.

## Tasks

- [x] **Cluster 1 — Sync shim removal**
  - [x] Migrate 11 sync test files + 1 engine module to import per-validator helpers from `validators/<name>.js` (2 `import *` files keep namespace import for vi.spyOn)
  - [x] Delete re-export block at `packages/sync/src/post-merge-validator.ts:38-53`
- [ ] **Cluster 2 — Import-core shim removal**
  - [ ] Update `packages/import-core/src/index.ts:52` barrel to re-export `buildPersistableEntity` from helpers
  - [ ] Migrate `packages/import-core/src/__tests__/import-engine-parsing.test.ts:14`
  - [ ] Migrate `packages/import-sp/src/__tests__/engine/import-engine-errors.test.ts:3`
  - [ ] Delete re-export at `packages/import-core/src/import-engine.ts:58`
  - [ ] Update stale JSDoc in `packages/import-core/src/import-engine.helpers.ts:7`
- [ ] **Cluster 3 — Mobile import-sp cleanup**
  - [ ] Slice `TRPCClientSubset` into per-builder `Pick` types (4 builders)
  - [ ] Un-export `Query`/`Mutation` generics in `trpc-persister-api.types.ts`
  - [ ] Move `AVATAR_ENCRYPTION_TIER` from `.types.ts` to `import-sp-mobile.constants.ts`
  - [ ] Inline `defaultFetch` into `trpc-persister-api.ts`, inline `sha256Hex` into `blob-and-refs.ts`
  - [ ] Delete `trpc-persister-api.helpers.ts`
  - [ ] Migrate `import.hooks.ts:42` and `__tests__/helpers/trpc-mock-client.ts:10` to import types from `.types.ts`
  - [ ] Delete shim at `trpc-persister-api.ts:21`
  - [ ] Migrate consumers of `useImportJob`/`useImportProgress`/`useImportSummary`/`ImportProgressSnapshot`/`ImportSummary` to import from `import-progress.hooks.js`
  - [ ] Delete orphaned re-export block at `import.hooks.ts:342-356`
- [ ] **Verification**
  - [ ] Targeted vitest projects (sync, import-core, mobile)
  - [ ] /verify full suite (format, lint, typecheck, unit, integration, e2e)
  - [ ] Grep guard: zero hits for old shim import paths
