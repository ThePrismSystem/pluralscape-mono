---
# api-hnso
title: Refactor timer-config.service.ts (494 LOC) into services/timer-config/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:09Z
updated_at: 2026-04-21T23:38:03Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `timer-config.service.ts` (~494 LOC) into `services/timer-config/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope

- [x] Read target file end-to-end; map exports to verb buckets
- [x] Create `services/timer-config/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [x] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [x] NO barrel file (no index.ts, no sibling .ts)
- [x] Delete `apps/api/src/timer-config.service.ts`
- [x] Update every caller's import to the specific verb file
- [x] Test vi.mock paths also updated per-verb
- [x] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/timer-config/update.ts:110 — preserves `as Record<string, unknown>` cast on drizzle `.set()` mixing typed cols with `sql` expr; flagged for deeper review (post-refactor) — low
- apps/api/src/services/timer-config/update.ts:71-100 — update path performs a read-before-write (SELECT current row) to recompute `nextCheckInAt`; could collapse into a single UPDATE ... RETURNING if scheduling fields absent — low (behavioral change, out of scope)
- apps/api/src/**tests**/services/timer-config.service.integration.test.ts:166 — `.map(i => ...)` previously untyped when module resolution failed; passes under new imports but worth adding explicit type annotation — trivial
