---
# infra-pz8z
title: Fix PR review issues for test framework setup
status: completed
type: task
priority: normal
created_at: 2026-03-08T22:13:40Z
updated_at: 2026-03-08T23:19:07Z
---

Address 15 issues from multi-model PR review: fix error swallowing in withTestTransaction, export TestDatabase type, simplify factories, consolidate vitest config, fix coverage gap, and minor fixes.

## Summary of Changes

- Fixed withTestTransaction error swallowing with sentinel RollbackError class
- Exported TestDatabase interface with schema generic + resource leak guard
- Simplified all 5 factories: removed sequences, used Partial<Output> for Input type
- Consolidated 6 identical vitest configs into root inline project definitions
- Deleted vitest.shared.ts (settings inlined into root config)
- Replaced tautology smoke test with module resolution check
- Added vitest as optional peer dep to test-utils
- Added integration test CI job
- Removed stale vitest.shared.ts from eslint ignores
- Added coverage gap documentation comment
