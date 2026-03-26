---
# api-ivfs
title: Friend routes
status: todo
type: feature
created_at: 2026-03-26T16:04:12Z
updated_at: 2026-03-26T16:04:12Z
parent: api-rl9o
blocked_by:
  - api-ujen
---

Account-level friend routes at /v1/account/friends/: GET /friends, GET /friends/:connectionId, POST /:connectionId/block, POST /:connectionId/remove, PUT /:connectionId/visibility, POST /:connectionId/archive, POST /:connectionId/restore. Account-level friend code routes at /v1/account/friend-codes/: POST, GET, POST /:codeId/archive, POST /redeem. System-level bucket assignment routes at /v1/systems/:systemId/buckets/:bucketId/friends/: POST (assign), DELETE (unassign), GET (list). Directional connection routing: /v1/account/friends/ returns viewer's own row; friend-facing routes validate direction. Files: new route dirs under routes/account/friends/, routes/account/friend-codes/, routes/buckets/friends/. Modify routes/account/index.ts, routes/buckets/index.ts.
