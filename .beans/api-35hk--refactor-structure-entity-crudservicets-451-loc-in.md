---
# api-35hk
title: Refactor structure-entity-crud.service.ts (451 LOC) into services/structure/entity-crud/
status: completed
type: task
priority: normal
created_at: 2026-04-21T22:28:09Z
updated_at: 2026-04-22T05:58:19Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `structure-entity-crud.service.ts` (~451 LOC) into `services/structure/entity-crud/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Special: creates services/structure/ cluster parent

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/structure/entity-crud/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/structure-entity-crud.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/structure-entity.service.ts:1 — pre-existing barrel re-exports all structure-_.service.ts; updated to re-export from services/structure/entity-crud/_ so 29 route/test files continue to work without touching scope-explosion — low
- apps/api/src/**tests**/routes/structure/entity-links/update.test.ts:28 — pre-existing mock used phantom export names (createEntity, listEntities, etc.) that never matched real exports; replaced with accurate per-verb module mocks — low
- Did not relocate sibling files (link/member-link/association) to services/structure/ to keep diff tight; safe to do in a later pass — info

## Summary of Changes

Shipped in PR #536 (refactor(api-6l1q): pr 2 — split 26 services into per-verb files).
