---
# api-wqlj
title: Refactor analytics.service.ts (454 LOC) into services/analytics/
status: completed
type: task
priority: normal
created_at: 2026-04-21T22:28:09Z
updated_at: 2026-04-22T05:58:19Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `analytics.service.ts` (~454 LOC) into `services/analytics/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/analytics/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/analytics.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/analytics.service.ts — split cleanly: 2 public verbs (computeFrontingBreakdown, computeCoFrontingBreakdown) with no shared internal helpers except toOneDecimalPercent — low
- apps/api/src/services/analytics/internal.ts — only one helper qualifies for shared (toOneDecimalPercent); fetchSessionsInRange, aggregateSubjectBreakdown, brandSubjectId, getClampedBounds, effectiveEndTime each stayed with single consumer — info
- apps/api/src/routes/analytics/{fronting,co-fronting}.ts and tRPC router now import two separate files — more explicit dependency graph — info

## Summary of Changes

Shipped in PR #536 (refactor(api-6l1q): pr 2 — split 26 services into per-verb files).
