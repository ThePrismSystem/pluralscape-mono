---
# ps-1o81
title: "PR #399 review fixes (critical + important + suggestions)"
status: in-progress
type: task
priority: high
created_at: 2026-04-08T00:37:43Z
updated_at: 2026-04-08T02:09:04Z
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
- [ ] Task 9: Final /verify and push

## Spec

docs/superpowers/specs/2026-04-07-pr-399-review-fixes-design.md (gitignored, local only)

## Plan

docs/superpowers/plans/2026-04-07-pr-399-review-fixes.md (gitignored, local only)

## Parent

Follows ps-5h7y (the original branch coverage raise). ps-5h7y is already completed; this bean tracks the follow-up review fixes as a separate unit of work.
