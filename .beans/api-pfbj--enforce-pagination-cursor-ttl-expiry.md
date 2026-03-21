---
# api-pfbj
title: Enforce pagination cursor TTL expiry
status: completed
type: task
priority: normal
created_at: 2026-03-16T09:05:28Z
updated_at: 2026-03-21T11:14:39Z
parent: api-0zl4
blocked_by:
  - api-g954
---

Add 24-hour TTL enforcement for pagination cursors. Expired cursors should return INVALID_CURSOR (400). Use PAGINATION.cursorTtlMs from @pluralscape/types. Per docs/planning/api-specification.md Section 3.

## Summary of Changes\n\nRedesigned pagination cursors to encode `{id, ts}` as base64url JSON with 24-hour TTL. Added `CursorExpiredError` to types package. Moved `toCursor()`/`fromCursor()` to API pagination lib. Added `parseCursor()` helper that returns decoded ID or throws `ApiHttpError(400, INVALID_CURSOR)`. Updated all 19 route handlers and 17 service files to use decoded string cursors.
