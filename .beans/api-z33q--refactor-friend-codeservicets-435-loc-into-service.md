---
# api-z33q
title: Refactor friend-code.service.ts (435 LOC) into services/account/friend-codes/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:10Z
updated_at: 2026-04-21T23:41:57Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `friend-code.service.ts` (~435 LOC) into `services/account/friend-codes/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Special: intra-PR-2 nest under services/account/

## Scope
- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/account/friend-codes/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/friend-code.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance
- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/__tests__/routes/account/pin.test.ts:49 — stale `vi.mock` for friend-code mocked non-existent exports (`createFriendCode`, `revokeFriendCode`); now repointed to new per-verb paths but exports still don't match real module — recommend deleting mock block (consumer doesn't import friend-code) — low
- apps/api/src/__tests__/services/analytics.service.test.ts:645 — `returns truncated flag` times out at 15s when full api suite runs in parallel (passes in isolation in 5s) — pre-existing flake under load, unrelated to this refactor — low
