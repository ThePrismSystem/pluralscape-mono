---
# api-g2jg
title: Active fronting query endpoint
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:48:57Z
updated_at: 2026-03-22T15:11:11Z
parent: api-5pvc
blocked_by:
  - api-vuhs
---

Specialized read-only endpoint for querying current fronters and co-fronting state.

## Acceptance Criteria

- [x] `GET /systems/:systemId/fronting/active` — returns all sessions with `end_time IS NULL`
- [x] Response includes member/custom-front/structure-entity subject info
- [x] Response includes structure entity membership data for fronting members (which entities each member belongs to)
- [x] Co-fronting detection: flag when multiple sessions are active simultaneously
- [x] Rate limit: readDefault
- [x] Route-level tests
- [x] OpenAPI spec in `paths/fronting-sessions.yaml`

## Summary of Changes

Implemented read-only active fronting query endpoint:

- GET /systems/:systemId/fronting/active returns all active sessions (end_time IS NULL)
- Response includes isCofronting flag and entityMemberMap for structure entity membership
- Uses partial index fronting_sessions_active_idx for efficient queries
- Route-level tests covering empty, single, co-fronting, and entity membership scenarios
