---
# crypto-o5dr
title: Add cache max size / LRU eviction to BucketKeyCache
status: draft
type: task
priority: low
created_at: 2026-03-14T08:08:34Z
updated_at: 2026-03-14T08:08:34Z
---

createBucketKeyCache() is unbounded. Add optional maxSize with LRU eviction (memzero on evict). Production hardening for systems with many buckets.
