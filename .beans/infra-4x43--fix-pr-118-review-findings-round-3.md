---
# infra-4x43
title: "Fix PR #118 review findings (round 3)"
status: completed
type: task
priority: normal
created_at: 2026-03-15T21:07:32Z
updated_at: 2026-04-16T07:29:39Z
parent: ps-vtws
---

Address remaining 7 issues and 8 suggestions from PR #118 multi-agent review: move MAX_FETCH to constants, inject clock into SQLite/mock workers, fire-hook console.warn fallback, stalled sweeper concurrent guard, poll backoff, ack retry, DLQ batchOp helper, HEAVY_BACKOFF constant, health comma-operator, JobId mapper, listJobs let-to-const, missing test coverage.

## Summary of Changes

All 12 steps from the PR #118 review plan implemented as individual commits:

1. **MAX_DEQUEUE_BATCH constant** — moved inline magic number to queue.constants.ts
2. **Clock injection** — SQLite and mock workers now accept optional clock parameter
3. **console.warn fallback** — fire-hook no longer silently swallows errors when no logger
4. **Concurrent sweep guard** — stalled sweeper skips overlapping sweeps via boolean flag
5. **Poll backoff** — all 3 workers use exponential backoff (100ms-30s) on poll failures
6. **Ack retry** — all 3 workers retry acknowledge up to 3 times with 50ms delay
7. **DLQ batchOp** — extracted shared iteration logic from replayAll/purge + filter tests
8. **HEAVY_BACKOFF** — extracted shared policy constant for 6 maintenance job types
9. **Health unwrapOr** — replaced comma-operator pattern with readable helper
10. **JobId in mapper** — fromStoredData now accepts branded JobId instead of string
11. **Single-pass filter** — listJobs uses const + .filter() instead of let reassignments
12. **Error property tests** — contract tests now assert jobId, currentStatus, etc.

All 246 queue tests pass. Typecheck and lint clean.
