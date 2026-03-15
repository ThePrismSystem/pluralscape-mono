---
# infra-tt0m
title: BullMQ Valkey queue adapter
status: in-progress
type: task
priority: normal
created_at: 2026-03-08T19:57:42Z
updated_at: 2026-03-15T08:53:59Z
parent: infra-m2t5
blocked_by:
  - infra-18r3
---

BullMQ adapter implementing the JobQueue interface for hosted and full self-hosted deployments.

## Scope

- Implement JobQueue interface using BullMQ backed by Valkey
- Priority queues, delayed jobs, rate limiting via BullMQ features
- Repeatable jobs for scheduled tasks (timer check-ins, periodic cleanup)
- Worker configuration: single-process (default) or separate worker processes for horizontal scaling
- Connection management: reuse Valkey connection from real-time pub/sub (ADR 007)
- Job serialization: JSON payloads with encrypted references only
- BullMQ event mapping to JobQueue event hooks
- Verify ioredis/Valkey compatibility under Bun runtime

## Acceptance Criteria

- [ ] JobQueue interface fully implemented with BullMQ
- [ ] Priority queue support
- [ ] Delayed and repeatable job scheduling
- [ ] Rate limiting per job type
- [ ] Valkey connection reuse with real-time subsystem
- [ ] Worker lifecycle (start, graceful shutdown)
- [ ] Bun runtime compatibility verified
- [ ] Integration tests against Valkey instance
- [ ] Unit tests for adapter methods

## References

- ADR 010 (Background Jobs — BullMQ)
- ADR 007 (Real-time — Valkey)
