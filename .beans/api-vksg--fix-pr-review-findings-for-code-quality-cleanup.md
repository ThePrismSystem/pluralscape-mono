---
# api-vksg
title: Fix PR review findings for code-quality-cleanup
status: in-progress
type: task
priority: normal
created_at: 2026-03-18T22:46:58Z
updated_at: 2026-03-18T22:47:10Z
---

Address 6 findings from PR review: fix concurrency test, remove dead guard in checkDependents, remove DEFAULT_RANGE_MS alias, add requireParam/requireIdParam unit tests, add systemId format validation test.

## TODO

- [x] Fix concurrency test: use deferred promises instead of eagerly-evaluated mockReturnValueOnce
- [x] Remove dead guard in checkDependents: replace for-loop with forEach
- [x] Remove DEFAULT_RANGE_MS alias in audit-log.ts, use MAX_RANGE_MS directly
- [x] Add requireParam unit tests (valid input, undefined, empty string)
- [x] Add requireIdParam unit tests (valid input, undefined, malformed ID)
- [x] Add systemId format validation test in memberships.test.ts
- [x] Verify: all tests pass, typecheck clean, lint clean
