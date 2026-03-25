---
# api-cqkh
title: Channel CRUD service
status: todo
type: feature
priority: high
created_at: 2026-03-25T05:59:18Z
updated_at: 2026-03-25T05:59:18Z
parent: api-ryy0
---

apps/api/src/services/channel.service.ts — Create, get, list (cursor pagination), update, archive/restore, delete (409 HAS_DEPENDENTS if has child channels or messages). RLS-wrapped via withTenantTransaction/withTenantRead. Tests: unit (all branches, error paths, 409 on delete with dependents) + integration (PGlite, real DB, RLS enforcement). 85%+ coverage.
