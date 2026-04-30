---
# sync-96hx
title: Split post-merge-validator.test.ts (2,728 LOC) by concern
status: todo
type: task
priority: normal
created_at: 2026-04-21T13:57:36Z
updated_at: 2026-04-30T05:00:04Z
parent: ps-36rg
---

Split packages/sync/src/**tests**/post-merge-validator.test.ts (2,728 LOC) into multiple files organized by the validator concern they exercise.

## Context

Post-merge-validator.ts itself is ~1,011 LOC covering seven distinct responsibilities: tombstone enforcement, hierarchy cycle detection, sort-order normalization, check-in record normalization, friend-connection normalization, fronting-session normalization, and fronting-comment author normalization. The monolithic test file mirrors all of these in one place.

## Scope

- [ ] Split into post-merge-validator-tombstones.test.ts, -hierarchy.test.ts, -sort-order.test.ts, -check-in.test.ts, -friend-connection.test.ts, -fronting-sessions.test.ts, -fronting-comments.test.ts
- [ ] Extract shared fixture setup into packages/sync/src/**tests**/helpers/validator-fixtures.ts
- [ ] Each resulting test file ≤500 LOC (stretch 350)
- [ ] Preserve every existing test case — count before and after must match or increase

## Out of scope

- Refactoring the validator implementation itself (separate concern)
- Other sync tests

## Acceptance

- pnpm vitest run --project sync passes
- Coverage for packages/sync unchanged or higher
- Original post-merge-validator.test.ts deleted
- Each new file ≤500 LOC (stretch 350)

## DRY pass

While extracting fixtures, scan sibling tests in packages/sync for the same setup duplication and consolidate when clear. Don't refactor production code outside test files. Per 2026-04-29 re-scope spec.
