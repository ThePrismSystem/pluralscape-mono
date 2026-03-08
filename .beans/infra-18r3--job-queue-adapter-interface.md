---
# infra-18r3
title: Job queue adapter interface
status: todo
type: task
priority: normal
created_at: 2026-03-08T19:57:24Z
updated_at: 2026-03-08T19:57:24Z
parent: infra-m2t5
---

Shared interface/adapter pattern for the dual-backend job queue system (BullMQ + SQLite).

## Scope

- `JobQueue` interface: enqueue, dequeue, acknowledge, fail, retry, getStatus, listPending, listFailed
- `JobWorker` interface: register handler by JobType, start processing, stop gracefully
- Idempotency key support: every job carries a unique key, workers check for prior completion
- Heartbeat interface: long-running jobs emit heartbeats, timeout detection for stalled jobs
- Dead-letter queue (DLQ) interface: move jobs exceeding max retries to DLQ
- Retry policy configuration: per-job-type max attempts, backoff strategy (exponential/linear), initial delay
- Job payload type constraints: payloads contain only IDs/references, never plaintext user data
- Event hooks: onComplete, onFail, onDLQ for observability integration

## Acceptance Criteria

- [ ] JobQueue interface with enqueue/dequeue/acknowledge/fail operations
- [ ] JobWorker interface with handler registration and lifecycle
- [ ] Idempotency key checking before job execution
- [ ] Heartbeat and timeout detection interfaces
- [ ] DLQ interface for failed jobs
- [ ] Retry policy configuration per job type
- [ ] Payload constraints enforced (no plaintext data)
- [ ] Event hooks for observability
- [ ] Interface tested with mock implementation
- [ ] Unit tests for adapter contract

## References

- ADR 010 (Background Jobs — job design principles)
- types-omwn (Background job types)
