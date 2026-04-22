---
# api-r37m
title: Refactor structure-entity-type.service.ts (359 LOC) into services/structure/entity-type/
status: completed
type: task
priority: normal
created_at: 2026-04-21T22:28:10Z
updated_at: 2026-04-22T05:58:20Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `structure-entity-type.service.ts` (~359 LOC) into `services/structure/entity-type/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Special: sibling of entity-crud under services/structure/

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/structure/entity-type/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/structure-entity-type.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/structure-entity.service.ts:1 — legacy barrel re-exports all structure service files; updated to re-export from new verb files so routes under /routes/structure/entity-types/\* keep working without per-route churn — low
- apps/api/src/**tests**/routes/structure/entity-links/update.test.ts:21 — had a vi.mock of structure-entity-type.service.js that was never actually imported/used in assertions; removed rather than redirecting — low
- apps/api/src/**tests**/trpc/routers/structure.test.ts — deleteEntityType was missing from pre-existing vi.mock block; added it along with per-verb mock modules — low

## Summary of Changes

Shipped in PR #536 (refactor(api-6l1q): pr 2 — split 26 services into per-verb files).
