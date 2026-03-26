---
# api-nsi8
title: Bucket access intersection logic
status: todo
type: feature
created_at: 2026-03-26T16:03:19Z
updated_at: 2026-03-26T16:03:19Z
parent: api-e3hk
blocked_by:
  - api-e3hk
---

Pure functions: checkBucketAccess(check: BucketAccessCheck): boolean (fail-closed: both sets non-empty + intersection) and filterVisibleEntities<T>(entities, friendBucketIds, entityBucketMap, scope): T[]. No DB or service deps. Files: apps/api/src/lib/bucket-access.ts (new). Tests: exhaustive unit tests (empty sets, no intersection, single/multiple intersections, scope).
