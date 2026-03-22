---
# api-3bzb
title: Timer config CRUD
status: completed
type: task
created_at: 2026-03-22T11:49:07Z
updated_at: 2026-03-22T11:49:07Z
parent: api-2z82
---

Service, routes, and tests for timer configuration management.

## Acceptance Criteria

- [x] `TimerConfigService` with create/list/get/update/archive/restore/delete
- [x] Enable/disable toggle (boolean field)
- [x] Waking hours validation: if `wakingHoursOnly=true`, both `wakingStart` and `wakingEnd` required, valid HH:MM format, `wakingStart < wakingEnd`
- [x] `intervalMinutes` validation: positive integer when provided
- [x] OCC version check on update
- [x] Delete returns 409 HAS_DEPENDENTS if check-in records exist
- [x] Routes at `/systems/:systemId/timer-configs`
- [x] Route-level tests
- [x] OpenAPI spec: `schemas/timers.yaml` + `paths/timer-configs.yaml`

## Summary of Changes

- Created `apps/api/src/services/timer-config.service.ts` with full CRUD, archive/restore, OCC
- Created route files at `apps/api/src/routes/timer-configs/`
- Added validation schemas in `packages/validation/src/timer.ts`
- Added audit events for timer configs to `packages/types/src/audit-log.ts`
- Added OpenAPI spec at `docs/openapi/schemas/timers.yaml` and `docs/openapi/paths/timer-configs.yaml`
- Route-level tests at `apps/api/src/__tests__/routes/timer-configs/crud.test.ts`
