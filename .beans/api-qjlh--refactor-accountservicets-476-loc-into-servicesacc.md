---
# api-qjlh
title: Refactor account.service.ts (476 LOC) into services/account/
status: todo
type: task
priority: normal
created_at: 2026-04-21T22:28:09Z
updated_at: 2026-04-21T22:28:09Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `account.service.ts` (~476 LOC) into `services/account/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Special: relocates friend-connection -> services/account/friends/

## Scope
- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/account/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/account.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance
- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)
