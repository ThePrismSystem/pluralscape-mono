---
# api-b2zz
title: Bucket CRUD routes
status: todo
type: feature
created_at: 2026-03-26T16:03:19Z
updated_at: 2026-03-26T16:03:19Z
parent: api-e3hk
blocked_by:
  - api-stvy
---

Create route files: POST /, GET /, GET /:bucketId, PUT /:bucketId, POST /:bucketId/archive, POST /:bucketId/restore, DELETE /:bucketId. Mount alongside existing rotation routes in routes/buckets/index.ts. Files: 7 new route files in apps/api/src/routes/buckets/, modify index.ts. Tests: route unit tests with createRouteApp, mock service layer.
