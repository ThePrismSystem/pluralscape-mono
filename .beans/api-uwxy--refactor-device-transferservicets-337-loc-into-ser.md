---
# api-uwxy
title: Refactor device-transfer.service.ts (337 LOC) into services/device-transfer/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:11Z
updated_at: 2026-04-21T23:45:01Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `device-transfer.service.ts` (~337 LOC) into `services/device-transfer/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/device-transfer/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/device-transfer.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/**tests**/services/analytics.service.test.ts — one parallel-run flake ("returns truncated flag" timeout 16s) observed once in full vitest run; passes in isolation and on rerun. Unrelated to refactor — low severity.
- apps/api/src/**tests**/routes/auth/recovery-key.test.ts:402 — unhandled rejection crashed runner in first full run (exit 144); passes cleanly in isolation and on rerun. Unrelated to refactor — low severity.
