---
# api-6m3p
title: Poll CRUD service
status: completed
type: task
priority: high
created_at: 2026-03-25T05:59:20Z
updated_at: 2026-03-25T23:40:20Z
parent: api-8lt2
blocked_by:
  - api-ho24
  - api-d0ej
---

apps/api/src/services/poll.service.ts — Create, get (with vote counts), list, update, close (set status=closed + closedAt), archive/restore, delete (409 if has votes). RLS-wrapped. Tests: unit (all branches, status transitions open→closed, close logic) + integration (PGlite). 85%+ coverage.

## Summary of Changes\n\nCreated poll.service.ts with 8 CRUD functions (create, get, list, update, close, delete, archive, restore). Integration tests cover all happy paths and error cases (24 tests). Added genPollId/genPollVoteId helpers.
