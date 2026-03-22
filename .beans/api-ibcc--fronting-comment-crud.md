---
# api-ibcc
title: Fronting comment CRUD
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:48:53Z
updated_at: 2026-03-22T14:52:49Z
parent: api-5pvc
blocked_by:
  - api-vuhs
---

Service, routes, and tests for fronting comments nested under sessions.

## Acceptance Criteria

- [x] `FrontingCommentService` with create/list/get/update/archive/restore/delete
- [x] Each comment has a `created_at` timestamp capturing when the comment was made
- [x] Polymorphic authorship — comments can be authored by a member, custom front, or structure entity (matching the session subject model). At least one of `member_id`, `custom_front_id`, `structure_entity_id` required on the comment
- [x] List endpoint: cursor pagination, filter by session, ordered by `created_at`
- [x] OCC version check on update
- [x] Routes at `/systems/:systemId/fronting-sessions/:sessionId/comments`
- [x] Route-level tests
- [x] OpenAPI spec in `paths/fronting-sessions.yaml` (nested under sessions)

## Schema Changes

- [x] Update `fronting_comments` table: add `custom_front_id` and `structure_entity_id` columns with RESTRICT FKs
- [x] Add author CHECK constraint (at least one of member_id, custom_front_id, structure_entity_id must be set)
- [x] Retain `session_start_time` in DB — required for FK into partitioned `fronting_sessions` table (Postgres requires partition key in FK references; see ADR 019). Service resolves `start_time` from the parent session on create; API responses omit it

## Summary of Changes

Implemented full CRUD for fronting comments with polymorphic authorship:

- DB schema: added customFrontId, structureEntityId columns + author CHECK constraint to both PG and SQLite schemas
- Types: updated FrontingComment and ServerFrontingComment with nullable polymorphic author fields
- CRDT: updated CrdtFrontingComment schema and strategy mutation semantics
- Service: create (resolves sessionStartTime internally), list, get, update (OCC), delete, archive, restore
- Routes: 8 route files nested at /:sessionId/comments
- Validation: create with author constraint, update with OCC
- Route-level tests covering all endpoints
