---
# infra-flqp
title: "Fix all PR #118 review findings"
status: completed
type: task
priority: high
created_at: 2026-03-15T19:22:35Z
updated_at: 2026-04-16T07:29:39Z
parent: ps-vtws
---

Address all 19 review issues from PR #118 (feat/retry-dlq-policies). Covers shared utility extraction, interface expansion, critical fixes, worker delegation, DLQ resilience, observability, cleanup, and generic typing.

## Summary of Changes

### Phase 1: Shared utility extraction

- [x] Extracted `fireHook` to `packages/queue/src/fire-hook.ts` with logger support
- [x] Added `fire-hook.test.ts` with 7 tests (dispatch, error swallowing, logger)
- [x] Exported `DEFAULT_RETRY_POLICY` from `policies/default-policies.ts`
- [x] Removed local `DEFAULT_RETRY_POLICY` copies from all 3 adapters
- [x] Replaced inline backoff formulas with `calculateBackoff()` in all `fail()` methods

### Phase 2: Interface expansion

- [x] Added `countJobs(filter)` to `JobQueue` interface
- [x] Implemented in InMemoryJobQueue, SqliteJobQueue, BullMQJobQueue, ObservableJobQueue
- [x] Added contract tests for countJobs (empty, by status, by type)

### Phase 3: Critical fixes

- [x] Replaced GET-then-SET idempotency with atomic SET NX in BullMQ
- [x] Replaced `redis.keys()` with cursor-based SCAN in BullMQ listJobs

### Phase 4: Worker delegation and error logging

- [x] BullMQ worker delegates fail/acknowledge to queue (fires hooks on normal path)
- [x] Added optional `logger` to BullMQ and SQLite workers
- [x] Logged swallowed errors in SQLite worker fail/acknowledge catch blocks
- [x] Logged poll errors in both workers

### Phase 5: maxRetries wiring

- [x] Enqueue uses `policy.maxRetries + 1` as default maxAttempts
- [x] Removed `DEFAULT_MAX_ATTEMPTS` constant from all adapters
- [x] Added contract tests for maxRetries wiring

### Phase 6: DLQ resilience

- [x] Added `BatchResult` type with succeeded/failed/errors
- [x] Updated `replayAll` and `purge` to return `BatchResult`
- [x] Added partial-failure tests for both operations

### Phase 7: Observability fixes

- [x] Wrapped `StalledJobSweeper.sweep()` in outer try/catch
- [x] Added test for findStalledJobs throwing
- [x] Created `observable-worker.test.ts` with 7 tests

### Phase 8: Exhaustive switch and cleanup

- [x] Exhaustive switch with `as never` default in mapStatusToBullMQStates
- [x] Replaced `Date.now()` with `this.clock()` in BullMQ dequeue/fail
- [x] Removed dead `fromBullMQJob` function and export
- [x] Removed \failed\ from JobStatus union + all downstream (enums, tests, adapters, DDL)

### Phase 9: Generic per-type payload typing

- [x] Added `JobPayloadMap` interface (all 15 types with `Record<string, unknown>`)
- [x] Made `JobDefinition<T>` generic with default `T = JobType`
- [x] Made `JobEnqueueParams<T>`, `JobHandler<T>`, enqueue/registerHandler generic
- [x] Updated all adapter implementations
- [x] Added `JobPayloadMap` type tests

### Phase 10: countJobs consumers

- [x] `DLQManager.depth()` uses `countJobs` instead of `listDeadLettered().length`
- [x] `QueueHealthService.getSummary()` uses `countJobs` for pending/running/dlq counts
