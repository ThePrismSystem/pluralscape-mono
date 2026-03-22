---
# sync-8ni9
title: CRDT sync strategies for fronting
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:49:00Z
updated_at: 2026-03-22T12:50:41Z
parent: api-5pvc
blocked_by:
  - api-vuhs
---

Register CRDT strategies for fronting sessions and comments.

## Acceptance Criteria

- [ ] Fronting session strategy: LWW-Map in `system-core` document, keyed by session ID
- [ ] Fronting comment strategy: LWW-Map in `system-core` document
- [ ] Conflict resolution: LWW per-field for sessions and comments
- [ ] Post-merge validation: sessions validate subject constraint, end_time > start_time
- [ ] Tests for merge conflict scenarios
