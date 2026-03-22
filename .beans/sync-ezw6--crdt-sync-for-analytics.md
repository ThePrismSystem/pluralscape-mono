---
# sync-ezw6
title: CRDT sync for analytics
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:49:57Z
updated_at: 2026-03-22T12:51:05Z
parent: api-8sel
blocked_by:
  - api-sheu
---

Register CRDT strategy for fronting reports. Analytics queries are server-computed (not synced).

## Acceptance Criteria

- [ ] Fronting report strategy: LWW-Map in `system-core` document (immutable snapshots, but synced for offline access)
- [ ] Analytics query results are NOT synced (computed on demand)
- [ ] Post-merge validation: report records are immutable — reject merges that modify existing report fields (only creation and deletion allowed)
- [ ] Tests for basic sync operations
