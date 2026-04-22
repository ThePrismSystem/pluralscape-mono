---
# api-ilo3
title: Refactor relationship.service.ts (395 LOC) into services/relationship/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:10Z
updated_at: 2026-04-21T23:29:50Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `relationship.service.ts` (~395 LOC) into `services/relationship/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/relationship/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/relationship.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/relationship.service.ts:365-371 — RELATIONSHIP_LIFECYCLE constant used only by archive/restore; colocated into lifecycle.ts — low
- apps/api/src/services/relationship.service.ts:62-90 — toRelationshipResult + RelationshipResult shared across 4 verb files; moved to internal.ts per pattern — low
- apps/api/src/**tests**/routes/relationships.test.ts, trpc/routers/relationship.test.ts — vi.mock() paths expanded from 1 to 4 targets (create/queries/update/lifecycle); pattern adds noise without barrel — low
