---
# api-5wmv
title: Acknowledgement CRUD service
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-26T04:31:42Z
parent: api-vjmu
blocked_by:
  - api-90im
  - api-d0ej
---

apps/api/src/services/acknowledgement.service.ts — Create (with target member, message), confirm (set confirmed=true idempotently), get, list (filter by confirmed/pending), archive, delete. RLS-wrapped. Tests: unit (all branches, confirm idempotency, pending filter) + integration (PGlite). 85%+ coverage.

## Summary of Changes\n\nCreated `apps/api/src/services/acknowledgement.service.ts` with 7 functions: create, confirm (idempotent), get, list (with confirmed/pending filter), archive, restore, delete. Updated DB schema to add `timestamps()` and `versioned()` mixins for pattern consistency. 24 integration tests passing.
