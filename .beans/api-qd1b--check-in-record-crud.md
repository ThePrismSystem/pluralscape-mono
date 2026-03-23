---
# api-qd1b
title: Check-in record CRUD
status: completed
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

- [x] `CheckInRecordService` with create/list/get/archive/delete
- [x] Respond action: `POST .../respond` — sets `responded_by_member_id` + `responded_at`, validates not already responded/dismissed
- [x] Dismiss action: `POST .../dismiss` — sets `dismissed=true`, validates not already responded/dismissed
- [x] List endpoint: cursor pagination, `timerConfigId` filter, `pending` filter (not responded, not dismissed, not archived)
- [x] No OCC version check — respond and dismiss are idempotent terminal state transitions (not general-purpose updates), so concurrent writers converge to the same final state without conflicts
- [x] Routes at `/systems/:systemId/check-in-records`
- [x] Route-level tests
- [x] OpenAPI spec: `paths/check-in-records.yaml`

## Summary of Changes

- Created `apps/api/src/services/check-in-record.service.ts` with CRUD, respond, dismiss, archive
- Created route files at `apps/api/src/routes/check-in-records/`
- Added validation schemas in `packages/validation/src/timer.ts`
- Added audit events for check-in records
- Added `ALREADY_RESPONDED` and `ALREADY_DISMISSED` to ApiErrorCode
- Route-level tests at `apps/api/src/__tests__/routes/check-in-records/crud.test.ts`
- OpenAPI spec at `docs/openapi/paths/check-in-records.yaml`
