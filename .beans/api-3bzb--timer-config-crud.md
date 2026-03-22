---
# api-3bzb
title: Timer config CRUD
status: todo
type: task
created_at: 2026-03-22T11:49:07Z
updated_at: 2026-03-22T11:49:07Z
parent: api-2z82
---

Service, routes, and tests for timer configuration management.

## Acceptance Criteria

- [ ] `TimerConfigService` with create/list/get/update/archive/restore/delete
- [ ] Enable/disable toggle (boolean field)
- [ ] Waking hours validation: if `wakingHoursOnly=true`, both `wakingStart` and `wakingEnd` required, valid HH:MM format, `wakingStart < wakingEnd`
- [ ] `intervalMinutes` validation: positive integer when provided
- [ ] OCC version check on update
- [ ] Delete returns 409 HAS_DEPENDENTS if check-in records exist
- [ ] Routes at `/systems/:systemId/timer-configs`
- [ ] Route-level tests
- [ ] OpenAPI spec: `schemas/timers.yaml` + `paths/timer-configs.yaml`
