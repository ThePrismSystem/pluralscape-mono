---
# api-sfms
title: Board message API routes
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:19Z
updated_at: 2026-03-25T11:30:15Z
parent: api-b46w
blocked_by:
  - api-7oey
  - api-pcak
---

apps/api/src/routes/board-messages/ — Standard CRUD + POST .../reorder + POST .../pin + POST .../unpin. Tests: unit (route validation, auth checks).

## Summary of Changes

Created 11 route files in `apps/api/src/routes/board-messages/`:

- CRUD: create (201), list (200), get (200), update (200), delete (204)
- Lifecycle: archive (204), restore (200)
- Special: reorder (204), pin (200), unpin (200)
- Barrel index.ts with route registration

Registered in `apps/api/src/routes/systems/index.ts` at `/:systemId/board-messages`.
Route unit tests in `apps/api/src/__tests__/routes/board-messages/crud.test.ts` (11 tests).
