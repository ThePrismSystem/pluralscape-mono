---
# sync-4fhk
title: CRDT sync for timers
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:49:18Z
updated_at: 2026-03-22T12:51:02Z
parent: api-2z82
blocked_by:
  - api-3bzb
---

Register CRDT strategies for timer configs and check-in records.

## Acceptance Criteria

- [ ] Timer config strategy: LWW-Map in `system-core` document
- [ ] Check-in record strategy: LWW-Map (respond/dismiss are field mutations)
- [ ] Conflict resolution: LWW per-field
- [ ] Post-merge validation: timer config validates `wakingStart < wakingEnd` when `wakingHoursOnly=true`, `intervalMinutes > 0`
- [ ] Tests for merge conflict scenarios
