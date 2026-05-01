---
# ps-oz0p
title: "Apply PR #603 review suggestions: drop shims, slice god-types, fold helpers"
status: in-progress
type: task
priority: normal
created_at: 2026-05-01T19:06:56Z
updated_at: 2026-05-01T19:17:47Z
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
- [ ] **Verification**
  - [ ] Targeted vitest projects (sync, import-core, mobile)
  - [ ] /verify full suite (format, lint, typecheck, unit, integration, e2e)
  - [ ] Grep guard: zero hits for old shim import paths
