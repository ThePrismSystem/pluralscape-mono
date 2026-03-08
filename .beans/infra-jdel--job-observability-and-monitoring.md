---
# infra-jdel
title: Job observability and monitoring
status: todo
type: task
priority: normal
created_at: 2026-03-08T19:58:04Z
updated_at: 2026-03-08T19:58:04Z
parent: infra-m2t5
blocked_by:
  - infra-18r3
---

Monitoring, status querying, and alerting for the job queue system.

## Scope

- Internal API endpoints: queue depth, job status by ID, failed job list, DLQ contents
- Structured logging for job lifecycle events (enqueue, start, complete, fail, DLQ)
- Heartbeat monitoring: detect stalled workers and jobs
- Metrics collection: jobs processed/minute, failure rate, average duration per job type
- Admin dashboard data: queue health summary for self-hosted admin UI
- Alert thresholds: configurable DLQ depth and failure rate triggers
- Both BullMQ and SQLite backends expose same observability interface

## Acceptance Criteria

- [ ] Job status queryable by ID via internal API
- [ ] Queue depth and health summary endpoint
- [ ] Structured logging for all job lifecycle events
- [ ] Stalled worker/job detection
- [ ] Metrics per job type (throughput, failure rate, duration)
- [ ] Configurable alert thresholds
- [ ] Same observability interface for both backends
- [ ] Unit tests for metrics calculation

## References

- ADR 010 (Background Jobs — observability)
