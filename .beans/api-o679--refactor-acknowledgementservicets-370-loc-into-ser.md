---
# api-o679
title: Refactor acknowledgement.service.ts (370 LOC) into services/acknowledgement/
status: in-progress
type: task
priority: normal
created_at: 2026-04-21T22:28:10Z
updated_at: 2026-04-21T23:37:46Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `acknowledgement.service.ts` (~370 LOC) into `services/acknowledgement/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/acknowledgement/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/acknowledgement.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/acknowledgement.service.ts:1-370 — 370 LOC monolith split into 5 files (internal 45, create 68, confirm 95, queries 109, lifecycle 72) — total 389 LOC, largest 109 — low
- 7 caller files updated (1 tRPC router + 6 REST routes + 3 test files); all vi.mock paths updated to per-verb modules — low
- pure code-motion; no behavior changes, no barrel; shared type+helper isolated in internal.ts (used by all 4 verb files) — low
