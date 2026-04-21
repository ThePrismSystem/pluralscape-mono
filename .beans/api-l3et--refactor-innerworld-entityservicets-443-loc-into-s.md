---
# api-l3et
title: Refactor innerworld-entity.service.ts (443 LOC) into services/innerworld/entity/
status: todo
type: task
priority: normal
created_at: 2026-04-21T22:28:10Z
updated_at: 2026-04-21T22:28:10Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `innerworld-entity.service.ts` (~443 LOC) into `services/innerworld/entity/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Special: creates services/innerworld/ cluster parent, may relocate innerworld-region and innerworld-canvas

## Scope
- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/innerworld/entity/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/innerworld-entity.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance
- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)
