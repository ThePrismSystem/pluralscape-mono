---
# api-nnin
title: Add route-level tests for innerworld endpoints
status: completed
type: task
priority: high
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:58:50Z
parent: api-i2pw
---

Innerworld entities (7 handlers), regions (7 handlers), and canvas (1 handler) have zero route-level tests. Service tests exist. Ref: audit T-3.

## Test Files — Entities (`apps/api/src/__tests__/routes/innerworld/entities/`)

- [ ] `get.test.ts` — GET /systems/:id/innerworld/entities/:entityId
  - 200 success returns entity
  - 404 entity not found
  - entityId param validated (innerWorldEntity prefix)

- [ ] `list.test.ts` — GET /systems/:id/innerworld/entities
  - 200 success returns paginated list
  - Query params: cursor, limit, regionId (optional filter), includeArchived
  - Respects DEFAULT_ENTITY_LIMIT / MAX_ENTITY_LIMIT

- [ ] `create.test.ts` — POST /systems/:id/innerworld/entities
  - 201 success returns created entity
  - 400 invalid body
  - Audit trail written, write rate limiter applied

- [ ] `update.test.ts` — PUT /systems/:id/innerworld/entities/:entityId
  - 200 success returns updated entity
  - 400 invalid body
  - 404 entity not found
  - Audit trail written, write rate limiter applied

- [ ] `delete.test.ts` — DELETE /systems/:id/innerworld/entities/:entityId
  - 200 success (hard delete)
  - 404 entity not found
  - Audit trail written, write rate limiter applied

- [ ] `archive.test.ts` — POST /systems/:id/innerworld/entities/:entityId/archive
  - 200 success archives entity
  - 404 entity not found
  - Audit trail written, write rate limiter applied

- [ ] `restore.test.ts` — POST /systems/:id/innerworld/entities/:entityId/restore
  - 200 success restores archived entity
  - 404 entity not found
  - Audit trail written, write rate limiter applied

## Test Files — Regions (`apps/api/src/__tests__/routes/innerworld/regions/`)

- [ ] `get.test.ts` — GET /systems/:id/innerworld/regions/:regionId
  - 200 success returns region
  - 404 region not found
  - regionId param validated (innerWorldRegion prefix)

- [ ] `list.test.ts` — GET /systems/:id/innerworld/regions
  - 200 success returns paginated list
  - Query params: cursor, limit, includeArchived (no regionId filter)
  - Respects DEFAULT_REGION_LIMIT / MAX_REGION_LIMIT

- [ ] `create.test.ts` — POST /systems/:id/innerworld/regions
  - 201 success returns created region
  - 400 invalid body
  - Audit trail written, write rate limiter applied

- [ ] `update.test.ts` — PUT /systems/:id/innerworld/regions/:regionId
  - 200 success returns updated region
  - 400 invalid body, 404 not found
  - Audit trail written, write rate limiter applied

- [ ] `delete.test.ts` — DELETE /systems/:id/innerworld/regions/:regionId
  - 200 success, 404 not found
  - Audit trail written, write rate limiter applied

- [ ] `archive.test.ts` — POST /systems/:id/innerworld/regions/:regionId/archive
  - 200 success, 404 not found
  - Audit trail written, write rate limiter applied

- [ ] `restore.test.ts` — POST /systems/:id/innerworld/regions/:regionId/restore
  - 200 success, 404 not found
  - Audit trail written, write rate limiter applied

## Test Files — Canvas (`apps/api/src/__tests__/routes/innerworld/canvas/`)

- [ ] `canvas.test.ts` — GET + PUT /systems/:id/innerworld/canvas
  - GET 200 returns canvas data
  - PUT 200 upserts canvas (creates or updates)
  - PUT 400 invalid body
  - PUT writes audit trail, write rate limiter applied
  - GET has no rate limiter or audit

## Implementation Notes

- Pattern: `__tests__/routes/custom-fronts/crud.test.ts`
- Entities and regions are structurally identical — same mock shape, same test structure, different ID prefixes and service imports
- Mock: innerworld entity/region/canvas service fns, auth middleware, rate-limit middleware, system-ownership
- Canvas is the simplest: only 2 operations (GET + PUT) in one test file
- All handlers use parseIdParam with typed ID prefixes

## Summary of Changes

Created 15 route-level test files across entities (7), regions (7), and canvas (1):

- apps/api/src/**tests**/routes/innerworld/entities/{get,list,create,update,delete,archive,restore}.test.ts
- apps/api/src/**tests**/routes/innerworld/regions/{get,list,create,update,delete,archive,restore}.test.ts
- apps/api/src/**tests**/routes/innerworld/canvas/canvas.test.ts

All 37 tests pass.
