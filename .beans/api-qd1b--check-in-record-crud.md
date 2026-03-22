---
# api-qd1b
title: Check-in record CRUD
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:49:11Z
updated_at: 2026-03-22T12:50:55Z
parent: api-2z82
blocked_by:
  - api-3bzb
---

Service, routes, and tests for check-in records (created by timer scheduler, responded to by users).

## Acceptance Criteria

- [ ] `CheckInRecordService` with create/list/get/archive/delete
- [ ] Respond action: `POST .../respond` — sets `responded_by_member_id` + `responded_at`, validates not already responded/dismissed
- [ ] Dismiss action: `POST .../dismiss` — sets `dismissed=true`, validates not already responded/dismissed
- [ ] List endpoint: cursor pagination, `timerConfigId` filter, `pending` filter (not responded, not dismissed, not archived)
- [ ] No OCC version check — respond and dismiss are idempotent terminal state transitions (not general-purpose updates), so concurrent writers converge to the same final state without conflicts
- [ ] Routes at `/systems/:systemId/check-in-records`
- [ ] Route-level tests
- [ ] OpenAPI spec: `paths/check-in-records.yaml`
