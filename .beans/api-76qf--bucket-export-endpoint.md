---
# api-76qf
title: Bucket export endpoint
status: todo
type: feature
created_at: 2026-03-26T16:05:59Z
updated_at: 2026-03-26T16:05:59Z
parent: client-vhga
blocked_by:
  - api-fc7h
---

GET /v1/systems/:systemId/buckets/:bucketId/export — owner-authenticated. Returns all entities tagged in bucket, organized by type, paginated. Reuses query helpers from db-xvkp. Files: apps/api/src/routes/buckets/export.ts (new), apps/api/src/services/bucket-export.service.ts (new), modify routes/buckets/index.ts. Tests: integration; correct entities, pagination, empty bucket, non-owner 404.
