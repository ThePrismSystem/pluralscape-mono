---
# sync-4fhk
title: CRDT sync for timers
status: todo
type: task
created_at: 2026-03-22T11:49:18Z
updated_at: 2026-03-22T11:49:18Z
parent: api-2z82
---

Register CRDT strategies for timer configs and check-in records.

## Acceptance Criteria

- [ ] Timer config strategy: LWW-Map in `system-core` document
- [ ] Check-in record strategy: LWW-Map (respond/dismiss are field mutations)
- [ ] Conflict resolution: LWW per-field
- [ ] Tests for merge conflict scenarios
