---
# api-1i0u
title: Refactor api-key.service.ts (356 LOC) into services/api-key/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:11Z
updated_at: 2026-04-21T23:41:59Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `api-key.service.ts` (~356 LOC) into `services/api-key/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope
- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/api-key/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/api-key.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance
- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/api-key.service.ts:4-12 — imports combined type+value from `@pluralscape/types` (createId, now, ID_PREFIXES as values plus brandId used on types); split cleanly on relocation; no change needed — info
- apps/api/src/services/api-key/internal.ts:82 — hashApiKeyToken/getHmacKey are shared by create.ts and validate.ts (2 consumers) so live in internal.ts per rule; other helpers (generateTokenPair, API_KEY_TOKEN_BYTES) remain local to create.ts — info
- apps/api/src/__tests__/helpers/common-route-mocks.ts:64-82 — replaced single mockApiKeyServiceFactory with three per-verb factories to match split; only api-keys.test.ts consumed it — info


- apps/api/src/__tests__/services/analytics.service.test.ts:computeCoFrontingBreakdown — flaky timeout under parallel load (15000ms), passes in isolation; unrelated to refactor — low
