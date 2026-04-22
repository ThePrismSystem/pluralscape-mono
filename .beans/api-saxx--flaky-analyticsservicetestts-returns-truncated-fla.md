---
# api-saxx
title: Flaky analytics.service.test.ts 'returns truncated flag' under parallel load
status: todo
type: bug
created_at: 2026-04-22T02:42:29Z
updated_at: 2026-04-22T02:42:29Z
parent: api-6l1q
---

Reported across 5 PR 2 beans (api-0ydp, api-1i0u, api-bf6p, api-uwxy, api-z33q) during the api-6l1q service refactor. Times out at 15-16s when the full api vitest suite runs in parallel; passes in isolation in ~5s. Pre-existing, unrelated to the refactor, but reliably reproduces under load.

## Scope

- Identify the slow path in computeCoFrontingBreakdown
- Either raise the per-test timeout, reduce test data volume, or optimize the aggregation
- Confirm no contention between parallel vitest workers on shared PGlite instance

## Acceptance

- Test passes consistently under full parallel vitest load (`pnpm test:unit`)
- No flakes across 10 consecutive runs
