---
# api-8qd6
title: Refactor note.service.ts (383 LOC) into services/note/
status: completed
type: task
priority: normal
created_at: 2026-04-21T22:28:10Z
updated_at: 2026-04-22T05:58:20Z
parent: api-6l1q
---

## Context

Part of epic api-6l1q PR 2. Refactor `note.service.ts` (~383 LOC) into `services/note/` with verb files — Option E pattern (no barrel, callers import from specific verb files). Reference: services/member/ from PR 1.

## Scope

- [ ] Read target file end-to-end; map exports to verb buckets
- [ ] Create `services/note/` with verb files (create, queries, update, lifecycle, etc. as fits)
- [ ] Shared helpers/types in `internal.ts` ONLY if used by ≥2 verb files
- [ ] NO barrel file (no index.ts, no sibling .ts)
- [ ] Delete `apps/api/src/note.service.ts`
- [ ] Update every caller's import to the specific verb file
- [ ] Test vi.mock paths also updated per-verb
- [ ] Capture findings under `## Findings` (do not fix inline)

## Acceptance

- `pnpm tsc -p apps/api/tsconfig.json --noEmit` passes
- `pnpm vitest run --project api` passes
- Max file LOC ≤300 target (350-400 acceptable if natural split)

## Findings

- apps/api/src/services/note.service.ts:383 — flat 383-LOC service split cleanly on verb boundaries (create/queries/update/lifecycle) — low
- apps/api/src/services/note/internal.ts — NoteResult + toNoteResult shared across create, queries, update, lifecycle (4 consumers) — info
- apps/api/src/**tests**/routes/notes/crud.test.ts — route test relied on single vi.mock of note.service.js; rewrote to 4 separate vi.mock blocks (create/queries/update/lifecycle) since route now imports 4 modules — medium
- apps/api/src/**tests**/trpc/routers/note.test.ts — same multi-module vi.mock rewrite required for trpc router test — medium
- apps/api/src/**tests**/services/note.service.test.ts — unit test uses dynamic imports; updated to import from 4 new paths — low
- ListNoteOpts interface — single consumer (listNotes), stayed local in queries.ts — info

## Summary of Changes

Shipped in PR #536 (refactor(api-6l1q): pr 2 — split 26 services into per-verb files).
