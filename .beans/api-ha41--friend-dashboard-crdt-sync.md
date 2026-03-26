---
# api-ha41
title: Friend dashboard CRDT sync
status: todo
type: feature
created_at: 2026-03-26T16:05:22Z
updated_at: 2026-03-26T16:05:22Z
parent: client-napj
blocked_by:
  - api-8312
---

Extend sync subscription filter to support friend-scoped access. When a friend client subscribes to sync updates, the filter must restrict the changeset to only entities visible through their assigned buckets. This is a security boundary: friends must never receive sync deltas for entities outside their bucket intersection. Modify packages/sync/src/subscription-filter.ts to add friendConnectionId-based filtering that cross-references bucket assignments and content tags. Files: modify packages/sync/src/subscription-filter.ts, add friend-filter.ts (new). Tests: integration; friend receives only bucket-tagged entity changes, untagged entities never leaked, bucket unassignment stops future deltas, new bucket assignment starts including matching entities.
