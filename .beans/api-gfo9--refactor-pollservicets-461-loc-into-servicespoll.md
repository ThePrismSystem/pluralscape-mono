---
# api-gfo9
title: Refactor poll.service.ts (461 LOC) into services/poll/
status: completed
type: task
priority: normal
created_at: 2026-04-21T22:28:09Z
updated_at: 2026-04-22T05:58:19Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `poll.service.ts` (~461 LOC) into `services/poll/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Special: relocates poll-vote -> services/poll/votes/

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/poll/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/poll.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/poll.service.ts (pre-split) — 461 LOC, 8 verb exports plus PollResult type and 2 shared helpers (toPollResult, throwPollUpdateError); POLL_LIFECYCLE shared between archive+restore → hoisted to internal.ts — low
- apps/api/src/services/poll/internal.ts — 108 LOC — largest file post-split; holds PollResult, ListPollOpts, toPollResult, throwPollUpdateError, POLL_LIFECYCLE; all multi-consumer helpers/types — low
- apps/api/src/services/poll/delete.ts — POLL_DELETE config + checkPollDependents are single-consumer, kept module-local per Option E rules — low
- PR-1 poll-vote/ moved to poll/votes/ cleanly; 6 files internally needed `../../` → `../../../` depth bumps and `../webhook-dispatcher.js` → `../../webhook-dispatcher.js` — low

## Summary of Changes

Shipped in PR #536 (refactor(api-6l1q): pr 2 — split 26 services into per-verb files).
