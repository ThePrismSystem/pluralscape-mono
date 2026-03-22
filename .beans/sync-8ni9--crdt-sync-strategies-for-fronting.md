---
# sync-8ni9
title: CRDT sync strategies for fronting
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:49:00Z
updated_at: 2026-03-22T15:15:36Z
parent: api-5pvc
blocked_by:
  - api-vuhs
---

Register CRDT strategies for fronting sessions and comments.

## Acceptance Criteria

- [x] Fronting session strategy: LWW-Map in `system-core` document, keyed by session ID
- [x] Fronting comment strategy: LWW-Map in `system-core` document
- [x] Conflict resolution: LWW per-field for sessions and comments
- [x] Post-merge validation: sessions validate subject constraint, end_time > start_time
- [x] Tests for merge conflict scenarios

## Summary of Changes

CRDT strategies were already registered. Added post-merge validation:

- normalizeFrontingSessions: nulls endTime when endTime <= startTime, emits notification for missing subjects
- Wired into runAllValidations for fronting documents
- Added frontingSessionNormalizations to PostMergeValidationResult
- Added resolution strategies: post-merge-endtime-normalize, notification-only
- Updated existing test mocks with new result field
