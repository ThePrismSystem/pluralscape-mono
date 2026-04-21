---
# mobile-8ovj
title: Extract apps/mobile/src/__tests__/factories.ts shared helpers
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:58:21Z
updated_at: 2026-04-21T16:41:56Z
parent: ps-0vwf
---

Consolidate the duplicated makeRaw\* fixture helpers scattered across mobile hook tests into a single factories module.

## Context

apps/mobile/src/hooks/**tests**/use-polls.test.tsx:191 defines makeRawPoll; use-notes.test.tsx:127 defines makeRawNote; use-fronting-sessions.test.tsx:133 defines makeRawSession; and ~30 other fixture functions are duplicated across mobile hook tests. Each drifts independently when the underlying type changes.

## Scope

- [x] Create apps/mobile/src/**tests**/factories.ts exporting makeRawPoll, makeRawNote, makeRawSession, makeRawMember, makeRawGroup, makeRawBucket, makeRawFrontingComment, makeRawCheckIn, makeRawBoardMessage, makeRawFieldDefinition, etc.
- [x] Enumerate every existing makeRaw\* in mobile tests and migrate to the shared module
- [x] Type each factory as (overrides?: Partial<Raw<Entity>>) => Raw<Entity>
- [x] Import from @pluralscape/types for entity shapes
- [x] Remove the now-unused local makeRaw\* definitions from individual test files

## Out of scope

- API/backend test factories (separate concern)
- Non-hook mobile tests (features/, data/) — unless they share the same pattern and benefit

## Acceptance

- pnpm vitest run --project mobile passes
- No makeRaw\* function defined in any individual hook test file
- Coverage unchanged or higher

## Notes

Pairs with the hand-rolled types audit (ps-6lwp) — any Raw<Entity> type that doesn't have a canonical home should surface during the audit.

## Summary of Changes

- Created `apps/mobile/src/__tests__/factories.ts` (~920 LOC) consolidating 28 `makeRaw*` factories from 23 hook tests into a single shared module.
- `TEST_MASTER_KEY` / `TEST_SYSTEM_ID` are re-exported from the canonical `hooks/__tests__/helpers/test-crypto.ts` to keep all test infrastructure on a single source of truth.
- Each factory now accepts an optional `Partial<EntityRaw>` overrides argument spread last, so test-specific tweaks no longer require re-declaring the whole fixture.
- Eight entity factories were renamed for disambiguation across the shared namespace: `makeRawSession` → `makeRawFrontingSession`, `makeRawRegion` → `makeRawInnerworldRegion`, `makeRawComment` → `makeRawFrontingComment`, `makeRawEvent` → `makeRawLifecycleEvent`, `makeRawEntity` → `makeRawStructureEntity` (use-structure-entities) or `makeRawInnerworldEntity` (use-innerworld-entities), `makeRawReport` → `makeRawFrontingReport`, `makeRawEntityType` → `makeRawStructureEntityType`. All call sites updated.
- Mobile test suite: 1354 tests pass across 124 files. pnpm lint and pnpm typecheck both exit 0.
