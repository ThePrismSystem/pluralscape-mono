---
# api-f98r
title: Refactor system.service.ts (308 LOC) into services/system/
status: completed
type: task
priority: normal
created_at: 2026-04-21T22:28:11Z
updated_at: 2026-04-22T05:58:20Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `system.service.ts` (~308 LOC) into `services/system/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Special: relocates import-entity-ref -> services/system/import-entity-refs/

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/system/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/system.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/system/import-entity-refs/internal.ts:152 — 152 LOC file carries big assertBrandedTargetId switch; largest file in new system/ tree but still below 300 LOC threshold — info

## Summary of Changes

Shipped in PR #536 (refactor(api-6l1q): pr 2 — split 26 services into per-verb files).
