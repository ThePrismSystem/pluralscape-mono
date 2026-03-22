---
# api-vuhs
title: Fronting session CRUD
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:48:47Z
updated_at: 2026-03-22T14:38:49Z
parent: api-5pvc
---

Service, routes, and tests for fronting session create/list/get/update/archive/restore/delete.

## Acceptance Criteria

- [x] `FrontingSessionService` with full CRUD operations
- [x] Partitioned table handling — composite PK `(id, start_time)`, queries use `start_time` range
- [x] Subject constraint enforced — at least one of `member_id`, `custom_front_id`, `structure_entity_id`
- [x] List endpoint supports: cursor pagination, `memberId` filter, `customFrontId` filter, `structureEntityId` filter, date range filter (`startAfter`/`startBefore`), `activeOnly` flag (end_time IS NULL), `includeArchived` flag
- [x] OCC version check on update via `assertOccUpdated`
- [x] Delete returns 409 HAS_DEPENDENTS if fronting comments exist
- [x] Retroactive session creation: accepts past `startTime` values
- [x] End session: sets `endTime`, validates `endTime > startTime`
- [x] Routes at `/systems/:systemId/fronting-sessions` following existing patterns
- [x] Rate limits: read (readDefault), write (write)
- [x] Route-level tests covering success paths + all error paths (validation, auth, not-found, conflict, subject constraint violation)
- [x] OpenAPI spec: `schemas/fronting.yaml` + `paths/fronting-sessions.yaml`

## Summary of Changes

Implemented full CRUD service and routes for fronting sessions:

- Service: create, list (with filters), get, update (OCC), end (with startTime validation), delete (with HAS_DEPENDENTS check), archive, restore
- Routes: 9 route files at /systems/:systemId/fronting-sessions
- Validation schemas: create (subject constraint), update, end, list query params
- Audit event types added to AuditEventType union
- Route-level tests covering all endpoints
- OpenAPI schemas and path specs
