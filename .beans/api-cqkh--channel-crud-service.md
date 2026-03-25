---
# api-cqkh
title: Channel CRUD service
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:18Z
updated_at: 2026-03-25T07:22:57Z
parent: api-ryy0
blocked_by:
  - api-258a
  - api-d0ej
---

apps/api/src/services/channel.service.ts — Create, get, list (cursor pagination), update, archive/restore, delete (409 HAS_DEPENDENTS if has child channels or messages). RLS-wrapped via withTenantTransaction/withTenantRead. Tests: unit (all branches, error paths, 409 on delete with dependents) + integration (PGlite, real DB, RLS enforcement). 85%+ coverage.

## Summary of Changes\n\nImplemented channel CRUD service with hierarchy validation, 409 HAS_DEPENDENTS on delete, cursor pagination, archive/restore. Full integration test suite.
