---
# api-5wmv
title: Acknowledgement CRUD service
status: todo
type: feature
priority: high
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-25T05:59:20Z
parent: api-vjmu
---

apps/api/src/services/acknowledgement.service.ts — Create (with target member, message), confirm (set confirmed=true idempotently), get, list (filter by confirmed/pending), archive, delete. RLS-wrapped. Tests: unit (all branches, confirm idempotency, pending filter) + integration (PGlite). 85%+ coverage.
