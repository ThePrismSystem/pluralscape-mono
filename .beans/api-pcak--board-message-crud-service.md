---
# api-pcak
title: Board message CRUD service
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T11:25:35Z
parent: api-b46w
blocked_by:
  - api-7oey
  - api-d0ej
---

apps/api/src/services/board-message.service.ts — Create, get, list (sorted by sortOrder), update, reorder (batch sortOrder update), pin/unpin, archive/restore, delete. Leaf entity (always deletable, no 409). RLS-wrapped. Tests: unit (all branches, reorder logic, pin/unpin) + integration (PGlite). 85%+ coverage.

## Summary of Changes

Created `apps/api/src/services/board-message.service.ts` with full CRUD:

- create, get, list (ID-ordered with cursor pagination, pinned filter)
- update (OCC), pin/unpin (dedicated state transitions)
- reorder (batch sortOrder update), delete (leaf entity)
- archive/restore (generic lifecycle helpers)

Integration tests in `apps/api/src/__tests__/services/board-message.service.integration.test.ts` (31 tests).
Added `genBoardMessageId()` helper and `ALREADY_PINNED`/`NOT_PINNED` API error codes.
