---
# api-pcak
title: Board message CRUD service
status: todo
type: feature
priority: high
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T05:59:19Z
parent: api-b46w
---

apps/api/src/services/board-message.service.ts — Create, get, list (sorted by sortOrder), update, reorder (batch sortOrder update), pin/unpin, archive/restore, delete. Leaf entity (always deletable, no 409). RLS-wrapped. Tests: unit (all branches, reorder logic, pin/unpin) + integration (PGlite). 85%+ coverage.
