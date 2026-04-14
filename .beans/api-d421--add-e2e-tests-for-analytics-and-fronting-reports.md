---
# api-d421
title: Add E2E tests for analytics and fronting-reports
status: completed
type: task
priority: high
created_at: 2026-04-14T09:29:19Z
updated_at: 2026-04-14T11:27:18Z
---

AUDIT [API-E2E-H1,H2] analytics/ (fronting analytics, co-fronting) and fronting-reports/ (full CRUD + archive/restore) have zero E2E specs. Both are core features with no end-to-end validation.

## Summary of Changes

Added E2E specs for analytics endpoints and fronting reports CRUD lifecycle:

- `apps/api-e2e/src/tests/analytics/fronting-analytics.spec.ts` — fronting analytics breakdown with date range presets/custom range, co-fronting analytics detecting overlapping sessions
- `apps/api-e2e/src/tests/fronting-reports/fronting-reports.spec.ts` — full CRUD lifecycle (create, list, get, update, archive, restore, delete, 404 after deletion), format validation

## Summary of Changes

Added E2E specs for analytics endpoints and fronting reports CRUD lifecycle.
