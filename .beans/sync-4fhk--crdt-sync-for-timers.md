---
# sync-4fhk
title: CRDT sync for timers
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:49:18Z
updated_at: 2026-03-22T12:51:02Z
parent: api-2z82
blocked_by:
  - api-3bzb
---

Register CRDT strategies for timer configs and check-in records.

## Acceptance Criteria

- [x] Timer config strategy: LWW-Map in `system-core` document
- [x] Check-in record strategy: LWW-Map (respond/dismiss are field mutations)
- [x] Conflict resolution: LWW per-field
- [x] Post-merge validation: timer config validates `wakingStart < wakingEnd` when `wakingHoursOnly=true`, `intervalMinutes > 0`
- [x] Tests for merge conflict scenarios

## Summary of Changes

- Timer config and check-in record CRDT strategies already existed in `crdt-strategies.ts`
- Added `normalizeTimerConfig` post-merge validator in `post-merge-validator.ts`
- Disables timers with invalid waking hours or non-positive intervalMinutes
- Added `timerConfigNormalizations` to `PostMergeValidationResult`
- Added `post-merge-timer-normalize` to `ConflictResolutionStrategy`
- Integrated into `runAllValidations`
- Tests at `packages/sync/src/__tests__/timer-crdt.test.ts` covering LWW merge, post-merge validation, and check-in record normalization
