---
# api-bf6p
title: Refactor lifecycle-event.service.ts (422 LOC) into services/lifecycle-event/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:10Z
updated_at: 2026-04-21T23:41:09Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `lifecycle-event.service.ts` (~422 LOC) into `services/lifecycle-event/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/lifecycle-event/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/lifecycle-event.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/lifecycle-event.service.ts:99-120 — cursor encode/decode only used by list, kept local to queries.ts — low
- apps/api/src/services/lifecycle-event.service.ts:392-398 — LIFECYCLE_EVENT_LIFECYCLE shared by archive+restore (2 consumers) — moved to internal.ts — low
- apps/api/src/**tests**/services/analytics.service.test.ts:645 — pre-existing flaky test "returns truncated flag" times out at 15s under full-parallel load; unrelated to this refactor — informational
