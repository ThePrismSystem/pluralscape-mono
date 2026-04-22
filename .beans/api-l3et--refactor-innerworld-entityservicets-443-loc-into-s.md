---
# api-l3et
title: Refactor innerworld-entity.service.ts (443 LOC) into services/innerworld/entity/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:10Z
updated_at: 2026-04-21T23:43:25Z
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

## Findings

- apps/api/src/services/innerworld-entity.service.ts (443 LOC) split into 5 files under services/innerworld/entity/ (max file = lifecycle.ts 148 LOC) — info
- services/innerworld-region/ relocated to services/innerworld/region/; no structure change — info
- services/innerworld-canvas.service.ts (155 LOC) moved as single-file peer services/innerworld/canvas.ts (Part C done) — info
- Prior commit 81d48af3 on branch landed Parts A/B/C but left 10 region+canvas test files with stale import paths; follow-up commit 7f25b3a7 fixed those — low
- Entity lifecycle (archive/restore/delete) grouped into lifecycle.ts mirrors region/ pattern; queries.ts groups list+get (2 read verbs) — info
