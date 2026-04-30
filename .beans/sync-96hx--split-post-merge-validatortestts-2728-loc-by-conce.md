---
# sync-96hx
title: Split post-merge-validator.test.ts (2,728 LOC) by concern
status: completed
type: task
priority: normal
created_at: 2026-04-21T13:57:36Z
updated_at: 2026-04-30T05:43:52Z
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

## Summary of Changes

Split `packages/sync/src/__tests__/post-merge-validator.test.ts` (3,216 LOC, 91 tests) into 9 concern-named files plus a shared helper, all under the 500-LOC cap.

**Concern files created:**

- `post-merge-validator-tombstones.test.ts` (406) — tombstone enforcement, ENTITY_FIELD_MAP, validateBucketContentTags
- `post-merge-validator-hierarchy.test.ts` (291) — group/region cycle detection, self-reference, orphan-parent
- `post-merge-validator-sort-order.test.ts` (315) — sort-order normalization, edge cases, NULL_GROUP partition
- `post-merge-validator-check-in.test.ts` (178) — check-in record normalization + runAllValidations dispatch
- `post-merge-validator-friend-connection.test.ts` (302) — friend-connection status normalization, branch coverage
- `post-merge-validator-fronting-sessions.test.ts` (370) — session endTime/subject normalization, edge cases
- `post-merge-validator-fronting-comments.test.ts` (344) — comment author normalization, runAllValidations dispatch

**Cross-cutting / branch coverage (split from runAllValidations + timer/webhook):**

- `post-merge-validator-runall-cross-cutting.test.ts` (282) — multi-validator interaction, onError plumbing
- `post-merge-validator-runall-branch-coverage.test.ts` (405) — timer/webhook config branch coverage

**Helper:** `packages/sync/src/__tests__/helpers/validator-fixtures.ts` (277) — `makeKeys`, `makeSessions`, `makeGroup`, `makeRegion`, `makeFrontingSession`, `makeTimer`, `makeWebhookSession`, `makeActiveMember`, `makeArchivedMember`, sodium lifecycle.

**Verification:**

- 63 sync test files pass, 951 tests green
- Total tests in new split files: 121 (vs 91 pre-split)
- Original file deleted
- Zero ESLint warnings
- All new files ≤500 LOC; pre-existing m4 file at 720 LOC not touched (out of scope)

**Deviation:** Task spec called for 7 concern files plus helper. The original file contained `runAllValidations` cross-cutting tests and `normalizeTimerConfig`/`normalizeWebhookConfigs` branch-coverage tests that don't map to any of the 7 listed concerns. Distributed dispatch tests to the relevant per-concern files; remaining cross-cutting tests went into two additional `runall-*` files (cross-cutting and branch-coverage) to keep all files under the 500-LOC cap.
