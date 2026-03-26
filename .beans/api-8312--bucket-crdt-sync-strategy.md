---
# api-8312
title: Bucket CRDT sync strategy
status: todo
type: feature
created_at: 2026-03-26T16:03:31Z
updated_at: 2026-03-26T16:03:31Z
parent: api-e3hk
blocked_by:
  - api-fc7h
---

EXTEND existing privacy-config and bucket sync schemas (already partially implemented). Add fieldBucketVisibility to privacy-config schema (currently missing). Resolve source-of-truth: DB friend_bucket_assignments table vs sync inline assignedBuckets — establish single projection path. Files: modify packages/sync/src/schemas/privacy-config.ts, bucket.ts, crdt-strategies.ts. Tests: document factory, sync lifecycle, assignment projection consistency.
