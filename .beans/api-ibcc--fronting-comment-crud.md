---
# api-ibcc
title: Fronting comment CRUD
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:48:53Z
updated_at: 2026-03-22T12:52:27Z
parent: api-5pvc
blocked_by:
  - api-vuhs
---

Service, routes, and tests for fronting comments nested under sessions.

## Acceptance Criteria

- [ ] `FrontingCommentService` with create/list/get/update/archive/restore/delete
- [ ] Each comment has a `created_at` timestamp capturing when the comment was made
- [ ] Polymorphic authorship — comments can be authored by a member, custom front, or structure entity (matching the session subject model). At least one of `member_id`, `custom_front_id`, `structure_entity_id` required on the comment
- [ ] List endpoint: cursor pagination, filter by session, ordered by `created_at`
- [ ] OCC version check on update
- [ ] Routes at `/systems/:systemId/fronting-sessions/:sessionId/comments`
- [ ] Route-level tests
- [ ] OpenAPI spec in `paths/fronting-sessions.yaml` (nested under sessions)

## Schema Changes

- Update `fronting_comments` table: add `custom_front_id` and `structure_entity_id` columns with RESTRICT FKs
- Add author CHECK constraint (at least one of member_id, custom_front_id, structure_entity_id must be set)
- Retain `session_start_time` in DB — required for FK into partitioned `fronting_sessions` table (Postgres requires partition key in FK references; see ADR 019). Service resolves `start_time` from the parent session on create; API responses omit it
