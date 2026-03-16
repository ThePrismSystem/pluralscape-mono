---
# infra-dzyr
title: SQLite in-process job queue
status: completed
type: task
priority: normal
created_at: 2026-03-08T19:57:49Z
updated_at: 2026-03-15T22:58:04Z
parent: infra-m2t5
blocked_by:
  - infra-18r3
---

SQLite-backed in-process queue adapter for minimal self-hosted deployments.

## Scope

- Implement JobQueue interface using SQLite job table (from db-fe5s schema)
- Single in-process worker with configurable poll interval
- Same retry/backoff/DLQ semantics as BullMQ adapter
- No external dependencies beyond existing SQLite database
- Poll-based dequeue with row locking (SQLite WAL mode)
- Job status transitions: pending -> processing -> completed/failed/dead-letter
- Heartbeat via timestamp update on job row
- Stalled job detection: jobs in processing state past timeout threshold
- Graceful shutdown: finish current job, mark remaining as pending

## Acceptance Criteria

- [ ] JobQueue interface fully implemented with SQLite
- [ ] Poll-based dequeue with configurable interval
- [ ] Retry with exponential backoff
- [ ] Dead-letter queue for exhausted retries
- [ ] Stalled job detection and recovery
- [ ] Graceful shutdown handling
- [ ] No external dependencies (SQLite only)
- [ ] Integration tests against SQLite database
- [ ] Performance test: throughput under load

## References

- ADR 010 (Background Jobs — SQLite fallback)
- db-fe5s (SQLite fallback job queue table)
