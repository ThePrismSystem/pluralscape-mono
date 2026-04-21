---
# mobile-8ovj
title: Extract apps/mobile/src/__tests__/factories.ts shared helpers
status: todo
type: task
created_at: 2026-04-21T13:58:21Z
updated_at: 2026-04-21T13:58:21Z
parent: ps-0vwf
---

Consolidate the duplicated makeRaw\* fixture helpers scattered across mobile hook tests into a single factories module.

## Context

apps/mobile/src/hooks/**tests**/use-polls.test.tsx:191 defines makeRawPoll; use-notes.test.tsx:127 defines makeRawNote; use-fronting-sessions.test.tsx:133 defines makeRawSession; and ~30 other fixture functions are duplicated across mobile hook tests. Each drifts independently when the underlying type changes.

## Scope

- [ ] Create apps/mobile/src/**tests**/factories.ts exporting makeRawPoll, makeRawNote, makeRawSession, makeRawMember, makeRawGroup, makeRawBucket, makeRawFrontingComment, makeRawCheckIn, makeRawBoardMessage, makeRawFieldDefinition, etc.
- [ ] Enumerate every existing makeRaw\* in mobile tests and migrate to the shared module
- [ ] Type each factory as (overrides?: Partial<Raw<Entity>>) => Raw<Entity>
- [ ] Import from @pluralscape/types for entity shapes
- [ ] Remove the now-unused local makeRaw\* definitions from individual test files

## Out of scope

- API/backend test factories (separate concern)
- Non-hook mobile tests (features/, data/) — unless they share the same pattern and benefit

## Acceptance

- pnpm vitest run --project mobile passes
- No makeRaw\* function defined in any individual hook test file
- Coverage unchanged or higher

## Notes

Pairs with the hand-rolled types audit (ps-6lwp) — any Raw<Entity> type that doesn't have a canonical home should surface during the audit.
