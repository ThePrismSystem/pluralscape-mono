---
# api-g2jg
title: Active fronting query endpoint
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:48:57Z
updated_at: 2026-03-22T12:50:41Z
parent: api-5pvc
blocked_by:
  - api-vuhs
---

Specialized read-only endpoint for querying current fronters and co-fronting state.

## Acceptance Criteria

- [ ] `GET /systems/:systemId/fronting/active` — returns all sessions with `end_time IS NULL`
- [ ] Response includes member/custom-front/structure-entity subject info
- [ ] Response includes structure entity membership data for fronting members (which entities each member belongs to)
- [ ] Co-fronting detection: flag when multiple sessions are active simultaneously
- [ ] Rate limit: readDefault
- [ ] Route-level tests
- [ ] OpenAPI spec in `paths/fronting-sessions.yaml`
