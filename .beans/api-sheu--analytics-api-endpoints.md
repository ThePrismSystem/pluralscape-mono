---
# api-sheu
title: Analytics API endpoints
status: completed
type: task
priority: normal
created_at: 2026-03-22T11:49:55Z
updated_at: 2026-03-22T12:50:47Z
parent: api-8sel
blocked_by:
  - api-xfh9
---

Read-only REST endpoints exposing analytics computations + report storage CRUD.

## Acceptance Criteria

- [x] `GET /systems/:systemId/analytics/fronting` — member breakdown with date range params
- [x] `GET /systems/:systemId/analytics/co-fronting` — co-fronting breakdown with date range params
- [x] `POST /systems/:systemId/fronting-reports` — store an immutable report snapshot (encrypted_data + format)
- [x] `GET /systems/:systemId/fronting-reports` — list reports (cursor pagination)
- [x] `GET /systems/:systemId/fronting-reports/:reportId` — get single report
- [x] `DELETE /systems/:systemId/fronting-reports/:reportId` — delete report
- [x] Rate limits: readDefault for queries, write for report create/delete
- [x] Route-level tests
- [x] OpenAPI spec: `schemas/analytics.yaml` + `paths/analytics.yaml` + `paths/fronting-reports.yaml`

## Summary of Changes

Created routes in `apps/api/src/routes/analytics/` (fronting + co-fronting GET endpoints) and `apps/api/src/routes/fronting-reports/` (CRUD: POST create, GET list, GET by ID, DELETE). Created `fronting-report.service.ts` for report CRUD. Added validation schemas in `packages/validation/src/analytics.ts`. Added audit events `fronting-report.created` and `fronting-report.deleted`. Registered routes in systems index. Created OpenAPI spec files. Rate limits: readDefault for analytics queries, write for report create/delete.
