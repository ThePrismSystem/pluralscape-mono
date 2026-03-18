---
# api-avcg
title: Add route tests for audit-log and structure membership endpoints
status: completed
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:58:51Z
parent: api-i2pw
---

Account audit-log route, layers/memberships, side-systems/memberships, and subsystems/memberships have no route-level tests. Ref: audit T-5, T-6.

## Test Files

- [ ] `apps/api/src/__tests__/routes/account/audit-log.test.ts` — GET /account/audit-log
  - 200 success returns paginated audit log entries
  - Query params: to, from (timestamps in ms), event_type, cursor, limit
  - Default range: from defaults to (to - maxQueryRangeDays), to defaults to now
  - 400 when to < from (invalid range)
  - 400 when query range exceeds AUDIT_RETENTION.maxQueryRangeDays
  - event_type filter forwarded to service
  - Pagination: cursor and limit forwarded correctly
  - Validated via AuditLogQuerySchema from @pluralscape/validation

- [ ] `apps/api/src/__tests__/routes/layers/memberships.test.ts` — /systems/:id/layers/:layerId/memberships
  - POST 201 adds layer membership (body validated, audit written)
  - POST 400 invalid body
  - DELETE 200 removes membership by membershipId (layerMembership prefix)
  - DELETE 404 membership not found
  - GET 200 lists memberships with pagination (cursor, limit)
  - GET respects DEFAULT_PAGE_LIMIT / MAX_PAGE_LIMIT
  - All write ops use write rate limiter and audit writer
  - Params: systemId (sys\_), layerId (layer prefix), membershipId (layerMembership prefix)

- [ ] `apps/api/src/__tests__/routes/side-systems/memberships.test.ts` — /systems/:id/side-systems/:sideSystemId/memberships
  - POST 201 adds side-system membership
  - POST 400 invalid body
  - DELETE 200 removes membership by membershipId (sideSystemMembership prefix)
  - DELETE 404 membership not found
  - GET 200 lists memberships with pagination
  - Params: systemId, sideSystemId (sideSystem prefix), membershipId (sideSystemMembership prefix)

- [ ] `apps/api/src/__tests__/routes/subsystems/memberships.test.ts` — /systems/:id/subsystems/:subsystemId/memberships
  - POST 201 adds subsystem membership
  - POST 400 invalid body
  - DELETE 200 removes membership by membershipId (subsystemMembership prefix)
  - DELETE 404 membership not found
  - GET 200 lists memberships with pagination
  - Params: systemId, subsystemId (subsystem prefix), membershipId (subsystemMembership prefix)

## Implementation Notes

- Pattern: `__tests__/routes/custom-fronts/crud.test.ts`
- All 3 membership routes are structurally identical (POST/GET/DELETE) — same mock shape, different ID prefixes and service imports
- Audit-log is unique: GET-only with custom date-range validation logic (maxQueryRangeDays, timestamp math)
- Mock: respective service fns, auth middleware, rate-limit middleware, system-ownership
- Audit-log uses AuditLogQuerySchema from @pluralscape/validation — test schema rejection paths

## Summary of Changes

Created 4 test files:

- apps/api/src/**tests**/routes/account/audit-log.test.ts (6 tests)
- apps/api/src/**tests**/routes/layers/memberships.test.ts (6 tests)
- apps/api/src/**tests**/routes/side-systems/memberships.test.ts (6 tests)
- apps/api/src/**tests**/routes/subsystems/memberships.test.ts (6 tests)

All 24 tests pass.
