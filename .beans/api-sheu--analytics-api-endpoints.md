---
# api-sheu
title: Analytics API endpoints
status: todo
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

- [ ] `GET /systems/:systemId/analytics/fronting` — member breakdown with date range params
- [ ] `GET /systems/:systemId/analytics/co-fronting` — co-fronting breakdown with date range params
- [ ] `POST /systems/:systemId/fronting-reports` — store an immutable report snapshot (encrypted_data + format)
- [ ] `GET /systems/:systemId/fronting-reports` — list reports (cursor pagination)
- [ ] `GET /systems/:systemId/fronting-reports/:reportId` — get single report
- [ ] `DELETE /systems/:systemId/fronting-reports/:reportId` — delete report
- [ ] Rate limits: readDefault for queries, write for report create/delete
- [ ] Route-level tests
- [ ] OpenAPI spec: `schemas/analytics.yaml` + `paths/analytics.yaml` + `paths/fronting-reports.yaml`
