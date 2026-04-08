---
# ps-1o81
title: "PR #399 review fixes (critical + important + suggestions)"
status: in-progress
type: task
priority: high
created_at: 2026-04-08T00:37:43Z
updated_at: 2026-04-08T02:35:45Z
---

Execute the implementation plan at docs/superpowers/plans/2026-04-07-pr-399-review-fixes.md to address all findings from the multi-agent review of PR #399.

## Scope

9 tasks, ~8 commits, on branch test/branch-coverage-91.

## Tasks

- [x] Task 1: Replace dead assertions in stream integration test (2 sites)
- [x] Task 2: Tighten DecryptionFailedError assertion in recovery-key test
- [x] Task 3: Align expo-secure-store mock with real API shape
- [x] Task 4: Cover REST route service-error to HTTP mapping (27 files)
- [x] Task 5: Tighten tRPC router arg assertions (10 files)
- [~] Task 6: Table-drive row-transforms tests (SCRAPPED — see ps-\*--row-transforms-refactor bean)
- [x] Task 7: Migrate stream test fixed sleeps to waitFor
- [x] Task 8: Create follow-up beans (PGlite audit + expo-sqlite smoke test)
- [x] Task 9: Final /verify and push (push pending user approval)

## Spec

docs/superpowers/specs/2026-04-07-pr-399-review-fixes-design.md (gitignored, local only)

## Plan

docs/superpowers/plans/2026-04-07-pr-399-review-fixes.md (gitignored, local only)

## Parent

Follows ps-5h7y (the original branch coverage raise). ps-5h7y is already completed; this bean tracks the follow-up review fixes as a separate unit of work.

## Summary of Changes

Executed the 9-task plan at docs/superpowers/plans/2026-04-07-pr-399-review-fixes.md to address all findings from the multi-agent review of PR #399.

### Commits added to test/branch-coverage-91 (on top of the original PR #399 stack)

1. 580f3e5a test(api): replace dead assertions in notifications stream test
2. 61ced92b test(api): tighten DecryptionFailedError assertion in recovery-key test
3. 4f9d70c5 test(mobile): align expo-secure-store mock with real API shape
4. 66bbb676 test(api): cover REST route service-error to HTTP mapping (27 files)
5. 9a7764ac test(api): tighten tRPC router arg assertions (3 files)
6. 3e49c0e7 test(api): tighten listFriendCodes arg assertion (review fix)
7. 9388388a test(api): migrate stream test sleeps to waitFor (4 migrations)
8. e94229bc chore(beans): add follow-up beans from PR #399 review fixes
9. 88256fbe chore(beans): fix formatting on ps-1o81 tracking bean

### Scrapped

- Task 6 (table-drive row-transforms.test.ts) — the original review suggestion assumed tests used expect(result).toEqual(expectedFullObject), but the tests use per-property assertions on branded union types. See mobile-thuh for follow-up investigation.

### Follow-up beans created

- api-9kl9 — Audit PGlite integration tests against Testcontainers requirement
- mobile-l0fq — Add real-SQLite smoke test for expo-sqlite-driver
- mobile-thuh — Investigate non-table-drive refactor options for row-transforms.test.ts (draft)

### Verification

Run 10571 (.tmp/verify/\*-10571.log):

- Format: PASS
- Lint: PASS
- Typecheck: PASS
- Unit: 756 files / 10892 tests passed
- Integration: 124 files / 2584 tests passed
- E2E: 461 tests passed
- E2E slow: 2 tests passed
- Coverage: statements 95.79%, branches 90.06%, functions 94.41%, lines 96.28% (all ≥89% floor)

### Not completed

Push to origin — pending user approval (per feedback_wait_for_push.md).
