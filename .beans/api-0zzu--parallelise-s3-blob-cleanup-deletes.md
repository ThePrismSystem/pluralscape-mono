---
# api-0zzu
title: Parallelise S3 blob cleanup deletes
status: completed
type: task
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T12:27:28Z
parent: api-v8zu
---

Finding [P3] from audit 2026-04-20. apps/api/src/jobs/blob-s3-cleanup.ts:43-53. S3 deletes sequential in for-loop with per-item heartbeat. Fix: Promise.allSettled in batches of 10-20.

## Summary of Changes

Replaced the sequential per-row S3 delete loop with parallel sub-batches of BLOB_S3_CLEANUP_PARALLEL_BATCH_SIZE=20 (Promise.allSettled). Partial failures inside a sub-batch are logged and the successes still hard-delete their metadata rows; heartbeat cadence moved from per-row to per-sub-batch. Added regression tests for the parallel sub-batching and partial-failure behaviour.
