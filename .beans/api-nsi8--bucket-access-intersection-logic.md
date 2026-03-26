---
# api-nsi8
title: Bucket access intersection logic
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:19Z
updated_at: 2026-03-26T20:11:05Z
parent: api-e3hk
---

Pure functions: checkBucketAccess(check: BucketAccessCheck): boolean (fail-closed: both sets non-empty + intersection) and filterVisibleEntities<T>(entities, friendBucketIds, entityBucketMap, scope): T[]. No DB or service deps. Files: apps/api/src/lib/bucket-access.ts (new). Tests: exhaustive unit tests (empty sets, no intersection, single/multiple intersections, scope).

## Summary of Changes

Created apps/api/src/lib/bucket-access.ts with two pure functions: checkBucketAccess (fail-closed Set intersection) and filterVisibleEntities (generic entity filtering by bucket overlap). Added comprehensive unit tests covering empty sets, no intersection, partial/full intersection, and untagged entities.
