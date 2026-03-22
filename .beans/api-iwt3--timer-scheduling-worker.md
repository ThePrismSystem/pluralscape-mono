---
# api-iwt3
title: Timer scheduling worker
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:49:16Z
updated_at: 2026-03-22T12:50:43Z
parent: api-2z82
blocked_by:
  - api-qd1b
---

BullMQ repeatable job that creates check-in records on schedule.

## Acceptance Criteria

- [ ] Repeatable BullMQ job registered on API startup
- [ ] Polls enabled, non-archived timer configs at their configured intervals
- [ ] Creates check-in records with `scheduled_at` timestamp
- [ ] Respects `waking_hours_only` — skips creation outside `waking_start`..`waking_end` window
- [ ] Handles disabled/archived timers gracefully (skip, don't error)
- [ ] Idempotent: re-running the same interval doesn't create duplicate records
- [ ] Unit tests for scheduling logic (waking hours filter, interval math)
- [ ] Integration test with Valkey-backed BullMQ queue
