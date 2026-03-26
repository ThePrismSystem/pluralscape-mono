---
# api-stvy
title: Bucket CRUD service
status: todo
type: feature
created_at: 2026-03-26T16:03:05Z
updated_at: 2026-03-26T16:03:05Z
parent: api-e3hk
---

Implement createBucket, listBuckets, getBucket, updateBucket, archiveBucket, restoreBucket, deleteBucket. Delete uses checkDependents querying 5 tables (bucketContentTags, keyGrants, friendBucketAssignments, fieldBucketVisibility, bucketKeyRotations) -> 409 HAS_DEPENDENTS. Follow note.service.ts pattern with entity-lifecycle.ts helpers. Files: apps/api/src/services/bucket.service.ts (new), bucket.constants.ts (new). Tests: unit (mock DB) + integration (PGlite).
