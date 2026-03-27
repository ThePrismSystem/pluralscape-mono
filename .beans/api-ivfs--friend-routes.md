---
# api-ivfs
title: Friend routes
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:04:12Z
updated_at: 2026-03-27T00:29:36Z
parent: api-rl9o
blocked_by:
  - api-ujen
  - api-1qcz
  - api-a71l
---

Account-level friend routes at /v1/account/friends/: GET /friends, GET /friends/:connectionId, POST /:connectionId/block, POST /:connectionId/remove, PUT /:connectionId/visibility, POST /:connectionId/archive, POST /:connectionId/restore. Account-level friend code routes at /v1/account/friend-codes/: POST, GET, POST /:codeId/archive, POST /redeem. System-level bucket assignment routes at /v1/systems/:systemId/buckets/:bucketId/friends/: POST (assign), DELETE (unassign), GET (list). Directional connection routing: /v1/account/friends/ returns viewer's own row; friend-facing routes validate direction. Files: new route dirs under routes/account/friends/, routes/account/friend-codes/, routes/buckets/friends/. Modify routes/account/index.ts, routes/buckets/index.ts.

## Summary of Changes

Implemented 3 route groups (18 route files + 3 index files) with 5 unit test files:

- **Account friend connection routes** (`routes/account/friends/`): list, get, block, remove, visibility, archive, restore
- **Account friend code routes** (`routes/account/friend-codes/`): create, list, archive, redeem (with validation via `RedeemFriendCodeBodySchema`)
- **Bucket friend assignment routes** (`routes/buckets/friends/`): assign, unassign, list
- Modified `routes/account/index.ts` and `routes/buckets/index.ts` to mount new route groups
- Visibility and redeem routes use `@pluralscape/validation` schemas for body validation
- All routes follow existing codebase patterns (rate limiting, audit writers, ID param validation)

## Summary of Changes\n\nCreated 21 route files across 3 groups: account friend connections (8 routes), account friend codes (5 routes), bucket friend assignments (4 routes). Modified account/index.ts and buckets/index.ts to mount the new routes. 5 unit test files for key routes. Static path ordering ensures /redeem mounts before /:codeId.
