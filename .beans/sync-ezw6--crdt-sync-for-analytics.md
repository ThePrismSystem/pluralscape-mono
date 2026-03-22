---
# sync-ezw6
title: CRDT sync for analytics
status: todo
type: task
created_at: 2026-03-22T11:49:57Z
updated_at: 2026-03-22T11:49:57Z
parent: api-8sel
---

Register CRDT strategy for fronting reports. Analytics queries are server-computed (not synced).

## Acceptance Criteria

- [ ] Fronting report strategy: LWW-Map in `system-core` document (immutable snapshots, but synced for offline access)
- [ ] Analytics query results are NOT synced (computed on demand)
- [ ] Tests for basic sync operations
