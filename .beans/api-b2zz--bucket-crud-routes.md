---
# api-b2zz
title: Bucket CRUD routes
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:19Z
updated_at: 2026-03-26T20:21:24Z
parent: api-e3hk
blocked_by:
  - api-stvy
---

Create route files: POST /, GET /, GET /:bucketId, PUT /:bucketId, POST /:bucketId/archive, POST /:bucketId/restore, DELETE /:bucketId. Mount alongside existing rotation routes in routes/buckets/index.ts. Files: 7 new route files in apps/api/src/routes/buckets/, modify index.ts. Tests: route unit tests with createRouteApp, mock service layer.

## Summary of Changes

Created 7 route files (create, list, get, update, delete, archive, restore) in apps/api/src/routes/buckets/. Updated index.ts to mount CRUD routes alongside existing rotation routes.
