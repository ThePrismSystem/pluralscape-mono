---
# infra-egog
title: Job retry and dead-letter policies
status: todo
type: task
priority: normal
created_at: 2026-03-08T19:57:57Z
updated_at: 2026-03-08T19:57:57Z
parent: infra-m2t5
blocked_by:
  - infra-18r3
---

Configure retry strategies and dead-letter queue handling per job type.

## Scope

- Per-job-type retry policy registry: map JobType to RetryPolicy
- Default policies:
  - Import jobs: 3 attempts, exponential backoff (1s, 4s, 16s)
  - Webhook delivery: 5 attempts, exponential backoff (30s, 2m, 8m, 32m, 2h)
  - Push notification: 3 attempts, linear backoff (5s, 10s, 15s)
  - Account purge: 3 attempts, exponential backoff (1m, 5m, 25m)
  - Key rotation: 2 attempts, exponential backoff (5m, 25m)
- DLQ management: list, inspect, replay, and permanently delete dead-lettered jobs
- Idempotency enforcement: check idempotency key before each attempt
- Admin alerting hook: trigger on DLQ insertion (configurable webhook/log)
- Metrics: track attempt counts, failure rates, DLQ depth per job type

## Acceptance Criteria

- [ ] Per-job-type retry policy configuration
- [ ] Default retry policies for all 9 job types
- [ ] Exponential and linear backoff strategies
- [ ] DLQ insertion on max retry exhaustion
- [ ] DLQ inspection and replay capability
- [ ] Idempotency key enforcement
- [ ] Admin alert hook on DLQ events
- [ ] Unit tests for backoff calculation
- [ ] Integration test: job exhausts retries and enters DLQ

## References

- ADR 010 (Background Jobs — retry and DLQ)
- types-omwn (Background job types — RetryPolicy)
