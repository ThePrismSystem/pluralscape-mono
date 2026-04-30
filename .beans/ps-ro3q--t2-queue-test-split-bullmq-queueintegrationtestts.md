---
# ps-ro3q
title: "T2 queue test split: bullmq-queue.integration.test.ts"
status: completed
type: task
priority: normal
created_at: 2026-04-30T05:02:07Z
updated_at: 2026-04-30T18:22:42Z
parent: ps-36rg
blocked_by:
  - sync-96hx
  - db-5bu5
  - ps-ga25
---

One file in packages/queue.

## Files

- [x] bullmq-queue.integration.test.ts (1,061)

## Acceptance

- pnpm vitest run --project queue-integration passes
- Coverage unchanged or higher

## Summary of Changes

Split `packages/queue/src/__tests__/bullmq-queue.integration.test.ts` (1,061 LOC, 128 tests once contract suites are expanded) into 6 focused files plus shared fixtures:

- `bullmq-queue-contract.integration.test.ts` (110 LOC, 3 tests + contract suites) — JobQueue/JobWorker contract harnesses, BullMQJobQueue-specific basic flow
- `bullmq-queue-connection.integration.test.ts` (69 LOC, 4 tests) — `createValkeyConnection` option branches (db, password, tls)
- `bullmq-queue-enqueue-branches.integration.test.ts` (271 LOC, 15 tests) — enqueue/idempotency branches and dequeue/cancel/retry transitions
- `bullmq-queue-listing-branches.integration.test.ts` (234 LOC, 14 tests) — listJobs, countJobs, findStalledJobs branch coverage
- `bullmq-queue-corruption-branches.integration.test.ts` (263 LOC, 9 tests) — `QueueCorruptionError` surfacing on corrupt JSON, schema mismatches, write-path corruption table-test
- `bullmq-queue-worker-branches.integration.test.ts` (187 LOC, 6 tests) — BullMQJobWorker lifecycle, poll, onStop branches
- `helpers/bullmq-test-fixtures.ts` (126 LOC) — shared `createQueue`, `createTracking`, `teardownTracking`, `corruptJobData`, `waitFor`, port constant, mock logger, and `unhandledRejection` handler

Also: added `fileParallelism: false` for the `queue-integration` project in `vitest.config.ts`. Multiple files all share the same Valkey container; running them in parallel produced state collisions (BullMQ queue/job leakage across test files). Sequential file execution preserves the single-process semantics the original test file enjoyed implicitly.

Test count preserved (128 -> 128). All resulting test files <=300 LOC. `pnpm vitest run --project queue-integration` passes. `pnpm typecheck`, `pnpm lint`, `pnpm format` all clean.
