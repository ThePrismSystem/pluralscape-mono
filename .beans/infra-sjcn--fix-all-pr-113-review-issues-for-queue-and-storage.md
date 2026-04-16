---
# infra-sjcn
title: "Fix all PR #113 review issues for queue and storage adapters"
status: completed
type: task
priority: normal
created_at: 2026-03-15T03:46:48Z
updated_at: 2026-04-16T07:29:40Z
parent: infra-o80c
---

Address all 20 findings from multi-agent review of PR #113: status precondition enforcement, worker error handling, type design fixes, test coverage gaps, and code simplification across @pluralscape/queue and @pluralscape/storage packages.

## Summary of Changes

Addressed all 20 findings from multi-agent PR #113 review:

**Type design (Issues 7, 9):**

- IdempotencyCheckResult converted to discriminated union (no existingJob on false branch)
- Added StorageKey branded type to @pluralscape/types

**Error handling (Issues 1, 2, 3, 4, 8):**

- Added InvalidJobTransitionError with status precondition guards on acknowledge, fail, retry, cancel, heartbeat
- Worker handler/acknowledge separation prevents ack failure from calling fail on success
- Poll failure tracking via consecutivePollFailures counter

**Test coverage (Issues 5, 11, 12):**

- findStalledJobs positive tests with injectable clock (stall detection + heartbeat reset)
- BlobTooLargeError tests for memory adapter maxSizeBytes
- Fixed handler failure test to assert dead-letter specifically

**Code quality (Issues 6, 13, 14, 15, 16, 17, 18, 19, 20):**

- Extracted priorityThenCreatedAt comparator, dequeueOrFail/delay helpers
- GHOST_JOB_ID constant, runningJob rename, fireHook overload removal
- Updated enqueue JSDoc for cancelled idempotency
- Branded return types on parseStorageKey/generateStorageKey
- Added @types/bun to storage devDependencies
