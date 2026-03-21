---
# crypto-o5dr
title: Add cache max size / LRU eviction to BucketKeyCache
status: completed
type: task
priority: low
created_at: 2026-03-14T08:08:34Z
updated_at: 2026-03-21T11:14:30Z
parent: api-0zl4
---

createBucketKeyCache() is unbounded. Add optional maxSize with LRU eviction (memzero on evict). Production hardening for systems with many buckets.

## Summary of Changes\n\nAdded optional `maxSize` parameter to `createBucketKeyCache()`. Implemented LRU eviction via Map re-insertion pattern — `get()` promotes entries, `set()` evicts oldest when at capacity. Versioned store uses `maxSize * 2` budget. All evicted keys are memzeroed. Backwards compatible when maxSize is omitted.
