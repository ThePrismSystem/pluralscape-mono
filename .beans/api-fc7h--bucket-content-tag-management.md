---
# api-fc7h
title: Bucket content tag management
status: todo
type: feature
created_at: 2026-03-26T16:03:19Z
updated_at: 2026-03-26T16:03:19Z
parent: api-e3hk
blocked_by:
  - api-stvy
---

Implement tagContent, untagContent, listTagsByBucket, listBucketsByEntity. Content tags are T3 metadata, leaf entities (always deletable). Files: bucket-content-tag.service.ts or extend bucket.service.ts; new routes at routes/buckets/tags/ (tag.ts, untag.ts, list.ts, index.ts). Tests: unit + integration; duplicate tag conflict, entity type validation, cross-bucket querying.
