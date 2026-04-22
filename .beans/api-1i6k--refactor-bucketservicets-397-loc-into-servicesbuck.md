---
# api-1i6k
title: Refactor bucket.service.ts (397 LOC) into services/bucket/
status: completed
type: task
priority: normal
created_at: 2026-04-21T22:28:10Z
updated_at: 2026-04-22T05:58:19Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `bucket.service.ts` (~397 LOC) into `services/bucket/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Special: relocates key-rotation -> services/bucket/rotations/

## Scope

- [x] Read target file end-to-end; map exports to verb buckets
- [x] Create `services/bucket/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [x] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [x] NO barrel file (no index.ts, no sibling .ts)
- [x] Delete `apps/api/src/bucket.service.ts`
- [x] Update every caller's import to the specific verb file
- [x] Test vi.mock paths also updated per-verb
- [x] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/bucket-export.service.ts — single-file constants-only `bucket-export.constants.ts` sibling + `bucket-export.service.ts` (still outside bucket/); leaving flat until future pass decides whether to nest under bucket/exports/ — info
- apps/api/src/services/bucket/rotations/retry.ts:96 — audit.detail uses `resetResult.length` which is reset count not retry count; pre-existing — info
- apps/api/src/services/bucket/delete.ts:18-50 — `checkBucketDependents` issues one UNION ALL against 5 dependent tables; single-consumer, kept module-local — info

## Summary of Changes

Shipped in PR #536 (refactor(api-6l1q): pr 2 — split 26 services into per-verb files).
