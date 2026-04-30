---
# ps-vrac
title: "T2 import-sp test split: engine/import-engine.test.ts"
status: completed
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T18:09:03Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

One file in packages/import-sp.

## Files

- [x] engine/import-engine.test.ts (1,150) — split by SP-specific phase (auth, fetch, mapping, persist)

## Acceptance

- pnpm vitest run --project import-sp passes
- Coverage unchanged or higher

## Out of scope

- import-sp engine changes
- Live API tests (gated behind SP_TEST_LIVE_API)

## Summary of Changes

Split `packages/import-sp/src/__tests__/engine/import-engine.test.ts` (1,150 LOC, 36 tests) into 4 focused files plus shared fixtures:

- `engine/import-engine-happy-path.test.ts` (421 LOC, 13 tests) — drop events, happy path walk, category opt-out, dropped collections, id translation, surprise policy
- `engine/import-engine-errors.test.ts` (232 LOC, 11 tests) — fatal/non-fatal mapper and persister errors, runtime guard for `buildPersistableEntity`
- `engine/import-engine-resume.test.ts` (106 LOC, 2 tests) — mid-collection resume and resume-cutoff-not-found
- `engine/import-engine-lifecycle.test.ts` (334 LOC, 10 tests) — legacy bucket synthesis, checkpoint frequency, abort signal, source.close()
- `helpers/import-engine-fixtures.ts` (93 LOC) — shared `RecordingPersister`, `createFakePersister`, `stubSource`, `noopProgress`, `ALL_CATEGORIES_ON`

All 36 tests preserved (count unchanged). All resulting files <=500 LOC. `pnpm vitest run --project import-sp` passes (389 tests, 1 skipped). `pnpm typecheck`, `pnpm lint`, `pnpm format` all clean.
