---
# queue-1o5p
title: Extract BaseJobWorker and consolidate queue worker constants
status: completed
type: task
priority: normal
created_at: 2026-03-21T03:04:01Z
updated_at: 2026-03-21T03:14:03Z
parent: ps-irrf
---

Addresses M3 audit findings Q-H1, Q-M7, and D-M1.

## Summary of Changes

- **Q-H1**: Extracted `BaseJobWorker` abstract class (`packages/queue/src/adapters/base-job-worker.ts`) containing ~120 lines of shared logic: handler registration, start/stop lifecycle, graceful shutdown with AbortController, processJob with ack-retry loop, poll backoff tracking, and heartbeat handle creation. Both `SqliteJobWorker` and `BullMQJobWorker` now extend `BaseJobWorker` and only implement adapter-specific `poll()` and lifecycle hooks.
- **Q-M7**: Moved `DEFAULT_POLL_INTERVAL_MS`, `DEFAULT_SHUTDOWN_TIMEOUT_MS`, and `SHUTDOWN_POLL_MS` from both worker files into `queue.constants.ts` with JSDoc and numeric underscores for readability. Exported from package index.
- **D-M1**: Created follow-up bean `queue-w2v3` for wiring queue sub-exports (`./sqlite`, `./bullmq`, `./policies`, `./dlq`, `./observability`) — M4+ scope.
