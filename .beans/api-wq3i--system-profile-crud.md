---
# api-wq3i
title: System profile CRUD
status: completed
type: task
priority: high
created_at: 2026-03-16T11:33:01Z
updated_at: 2026-03-17T01:46:15Z
parent: api-o89k
blocked_by:
  - api-1v5r
---

GET/PUT/DELETE /systems/:id (read/update/delete encrypted system profile), POST /systems (create additional system for multi-system accounts). Includes OCC via version column.

## Tasks

- [x] Validation schema (UpdateSystemBodySchema) + tests
- [x] Service layer (system.service.ts) + tests
- [x] Constants file (systems.constants.ts)
- [x] Route handlers (get/update/delete/create) + tests
- [x] Wire up: mount routes, export validation, add audit event types
- [x] Verify: typecheck, lint, all tests pass

## Summary of Changes

Implemented full system profile CRUD:

- GET /systems/:id — read encrypted profile
- PUT /systems/:id — update with OCC via version
- DELETE /systems/:id — restricted hard delete (rejects if members exist or last system)
- POST /systems — create additional system (multi-system accounts)

New files: validation schema, service layer, 4 route handlers, constants, barrel, 6 test files (37 tests). Added 3 audit event types (system.created, system.profile-updated, system.deleted).
