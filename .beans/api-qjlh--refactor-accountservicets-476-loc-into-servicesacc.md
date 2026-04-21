---
# api-qjlh
title: Refactor account.service.ts (476 LOC) into services/account/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:09Z
updated_at: 2026-04-21T22:44:22Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `account.service.ts` (~476 LOC) into `services/account/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Special: relocates friend-connection -> services/account/friends/

## Scope

- [x] Read target file end-to-end; map exports to verb buckets
- [x] Create `services/account/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [x] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [x] NO barrel file (no index.ts, no sibling .ts)
- [x] Delete `apps/api/src/account.service.ts`
- [x] Update every caller's import to the specific verb file
- [x] Test vi.mock paths also updated per-verb
- [x] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/account/update.ts:473 — `ConcurrencyError` extracted to internal.ts; imported by 3 routes + 4 test files + pin.test.ts as shared mutation-retry primitive — low
- apps/api/src/services/account/friends/\* — PR-1 dir relocated under account/; all `../../lib/`, `../../http.constants.js`, `../../service.constants.js`, `../webhook-dispatcher.js` paths rewritten to `../../../` to account for extra nesting — low
