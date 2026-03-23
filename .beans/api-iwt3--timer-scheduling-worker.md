---
# api-iwt3
title: Timer scheduling worker
status: completed
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

- [x] Repeatable BullMQ job registered on API startup
- [x] Polls enabled, non-archived timer configs at their configured intervals
- [x] Creates check-in records with `scheduled_at` timestamp
- [x] Respects `waking_hours_only` — skips creation outside `waking_start`..`waking_end` window
- [x] Handles disabled/archived timers gracefully (skip, don't error)
- [x] Idempotent: re-running the same interval doesn't create duplicate records
- [x] Unit tests for scheduling logic (waking hours filter, interval math)
- [ ] Integration test with Valkey-backed BullMQ queue (deferred: requires live Valkey)

## Summary of Changes

- Created `apps/api/src/jobs/check-in-generate.ts` with job handler
- Added `check-in-generate` job type to `packages/types/src/jobs.ts`
- Added retry policy in `packages/queue/src/policies/default-policies.ts`
- Pure function helpers: `parseTimeToMinutes`, `isWithinWakingHours`, `getCurrentMinutesUtc`, `computeIdempotencyKey`
- Idempotent via scheduledAt range check within the interval window
- Unit tests at `apps/api/src/__tests__/check-in-generate.test.ts`
