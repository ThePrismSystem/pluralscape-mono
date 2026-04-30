---
# api-4cmq
title: "T2 api ws+trpc test splits: 4 files (investigate ws/handlers dup)"
status: completed
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T17:41:53Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

Four files in apps/api WS + tRPC layer. Investigate and resolve the two ws/handlers.test.ts duplicates as part of this PR.

## Files

- [x] **tests**/ws/handlers.test.ts (1,042) — investigate vs the second handlers.test.ts; dedupe if confirmed duplicate
- [x] ws/**tests**/handlers.test.ts (928) — investigate vs first
- [x] **tests**/ws/message-router.test.ts (1,406)
- [x] **tests**/trpc/routers/structure.test.ts (875)

## Acceptance

- pnpm vitest run --project api passes
- Duplicate handlers.test.ts resolved with explanation in PR description

## Out of scope

- WS protocol changes, tRPC router changes

## Summary of Changes

Split four oversized test files in `apps/api/` (ws + tRPC layer) so every
resulting file is ≤500 LOC, all tests preserved, no behavior changes.

**Duplicate `handlers.test.ts` resolution.** The two files cover distinct
test bodies despite overlapping describe block names:

- `apps/api/src/__tests__/ws/handlers.test.ts` (1,042 LOC, 35 tests) was the
  happy-path suite (real `EncryptedRelay`, success-path branches).
- `apps/api/src/ws/__tests__/handlers.test.ts` (928 LOC, 35 tests) was the
  branch-coverage suite (mocked relay, error / edge / verification paths).

They are not duplicates and were left in their respective directories;
each was split independently into concern-named files.

**Splits.**

| Source                                     |  LOC | New files                                                                                                         |
| ------------------------------------------ | ---: | ----------------------------------------------------------------------------------------------------------------- |
| `__tests__/ws/handlers.test.ts`            | 1042 | `handlers-doc-ops.test.ts` (401), `handlers-subscribe.test.ts` (247), `handlers-submit.test.ts` (341)             |
| `ws/__tests__/handlers.test.ts`            |  928 | `handlers-submit-errors.test.ts` (314), `handlers-misc-errors.test.ts` (482)                                      |
| `__tests__/ws/message-router.test.ts`      | 1406 | `message-router-auth.test.ts` (417), `message-router-access.test.ts` (402), `message-router-errors.test.ts` (493) |
| `__tests__/trpc/routers/structure.test.ts` |  875 | `structure-entity-type.test.ts` (278), `structure-entity.test.ts` (277), `structure-relations.test.ts` (386)      |

**Shared fixtures extracted (≤500 LOC each, no `vi.mock` to keep hoisting per-file):**

- `__tests__/helpers/ws-handlers-fixtures.ts` (126) — happy-path mock factories.
- `ws/__tests__/handlers-fixtures.ts` (183) — error-path mock relay/db builders.
- `__tests__/ws/message-router-fixtures.ts` (187) — `addAuthedConnection`,
  `makeBrokenRelayContext`, `makeBrokenWsConnection`, `makeChangePayload`,
  `makeSnapshotPayload`, `lastResponse`, etc. used by all 3 message-router files.
- `__tests__/trpc/routers/structure-fixtures.ts` (97) — IDs and mock results.

**Test counts (preserved):**

- ws happy: 35 → 17 + 8 + 10 = 35
- ws edge: 35 → 14 + 21 = 35
- message-router: 51 → 20 + 16 + 15 = 51
- structure: 45 → 13 + 13 + 19 = 45

**DRY consolidations.**

- `addAuthedConnection` collapses ~20 lines of register+authenticate boilerplate
  per use site into 1 call (used 4× in router-errors, 1× in router-access via
  `makeBrokenWsConnection`).
- `makeBrokenRelayContext` collapses the per-test inline broken-relay literal
  (~10 lines each) into a 4-line factory call (used in 6 INTERNAL_ERROR tests).
- `makeSnapshotPayload` consolidates the 6-line snapshot envelope literal
  used by 4 SubmitSnapshotRequest tests.

**Verification:** `pnpm lint`, `pnpm format`, `pnpm typecheck`, and
`pnpm vitest run --project api` all pass; full suite reports 5,245 tests
passing across 454 files (no count change vs main).
