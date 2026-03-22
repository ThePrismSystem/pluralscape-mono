---
# api-vuhs
title: Fronting session CRUD
status: todo
type: task
created_at: 2026-03-22T11:48:47Z
updated_at: 2026-03-22T11:48:47Z
parent: api-5pvc
---

Service, routes, and tests for fronting session create/list/get/update/archive/restore/delete.

## Acceptance Criteria

- [ ] `FrontingSessionService` with full CRUD operations
- [ ] Partitioned table handling — composite PK `(id, start_time)`, queries use `start_time` range
- [ ] Subject constraint enforced — at least one of `member_id`, `custom_front_id`, `structure_entity_id`
- [ ] List endpoint supports: cursor pagination, `memberId` filter, `customFrontId` filter, `structureEntityId` filter, date range filter (`startAfter`/`startBefore`), `activeOnly` flag (end_time IS NULL), `includeArchived` flag
- [ ] OCC version check on update via `assertOccUpdated`
- [ ] Delete returns 409 HAS_DEPENDENTS if fronting comments exist
- [ ] Retroactive session creation: accepts past `startTime` values
- [ ] End session: sets `endTime`, validates `endTime > startTime`
- [ ] Routes at `/systems/:systemId/fronting-sessions` following existing patterns
- [ ] Rate limits: read (readDefault), write (write)
- [ ] Route-level tests covering success paths + all error paths (validation, auth, not-found, conflict, subject constraint violation)
- [ ] OpenAPI spec: `schemas/fronting.yaml` + `paths/fronting-sessions.yaml`
