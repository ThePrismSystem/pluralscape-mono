---
# api-0ydp
title: Refactor channel.service.ts (472 LOC) into services/channel/
status: completed
type: task
priority: normal
created_at: 2026-04-21T22:28:09Z
updated_at: 2026-04-22T05:58:19Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `channel.service.ts` (~472 LOC) into `services/channel/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/channel/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/channel.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/channel.service.ts:438 — CHANNEL_LIFECYCLE config shared by archive + restore; moved to internal.ts per >=2 verbs rule — low
- apps/api/src/**tests**/services/analytics.service.test.ts:645 — flaky timeout (15s) under concurrent vitest runs; unrelated to channel refactor — medium
- Test vi.mock call sites (crud.test.ts, trpc router test) previously mocked the old barrel path — rewritten into per-verb vi.mock blocks in the same test files — low

## Summary of Changes

Shipped in PR #536 (refactor(api-6l1q): pr 2 — split 26 services into per-verb files).
