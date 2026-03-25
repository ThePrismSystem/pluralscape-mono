---
# api-pcak
title: Board message CRUD service
status: todo
type: task
priority: high
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T05:59:19Z
parent: api-b46w
blocked_by:
  - api-7oey
  - api-d0ej
---

apps/api/src/services/board-message.service.ts — Create, get, list (sorted by sortOrder), update, reorder (batch sortOrder update), pin/unpin, archive/restore, delete. Leaf entity (always deletable, no 409). RLS-wrapped. Tests: unit (all branches, reorder logic, pin/unpin) + integration (PGlite). 85%+ coverage.
