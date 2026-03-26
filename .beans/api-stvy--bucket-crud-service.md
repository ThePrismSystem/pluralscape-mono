---
# api-stvy
title: Bucket CRUD service
status: completed
type: feature
priority: normal
created_at: 2026-03-26T16:03:05Z
updated_at: 2026-03-26T20:16:59Z
parent: api-e3hk
---

Implement createBucket, listBuckets, getBucket, updateBucket, archiveBucket, restoreBucket, deleteBucket. Delete uses checkDependents querying 5 tables (bucketContentTags, keyGrants, friendBucketAssignments, fieldBucketVisibility, bucketKeyRotations) -> 409 HAS_DEPENDENTS. Follow note.service.ts pattern with entity-lifecycle.ts helpers. Files: apps/api/src/services/bucket.service.ts (new), bucket.constants.ts (new). Tests: unit (mock DB) + integration (PGlite).

## Summary of Changes

Created bucket.service.ts with full CRUD (create, get, list, update, archive, restore, delete), parseBucketQuery, and checkBucketDependents (5-table check). Created bucket.constants.ts with MAX_BUCKETS_PER_SYSTEM. Follows note.service.ts pattern: RLS context, OCC updates, cursor pagination, audit/webhook dispatch.
