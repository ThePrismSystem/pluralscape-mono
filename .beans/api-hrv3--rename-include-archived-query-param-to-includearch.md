---
# api-hrv3
title: Rename include_archived query param to includeArchived
status: completed
type: task
priority: low
created_at: 2026-03-18T15:58:21Z
updated_at: 2026-03-20T18:37:06Z
parent: api-765x
---

L1: Rename snake_case query parameter to camelCase for API consistency.

## Acceptance Criteria

- Query parameter renamed from `include_archived` to `includeArchived` on all endpoints
- Old parameter name rejected with 400 error (no silent alias — pre-production, no backwards compat)
- Zod schemas updated for new parameter name
- All tests updated to use new parameter name
- Integration tests: new param works; old param → 400

## Summary of Changes

Already implemented — all routes and Zod schemas use `includeArchived` (camelCase).
