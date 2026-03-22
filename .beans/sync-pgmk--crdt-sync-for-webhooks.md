---
# sync-pgmk
title: CRDT sync for webhooks
status: todo
type: task
created_at: 2026-03-22T11:49:38Z
updated_at: 2026-03-22T11:49:38Z
parent: api-i8ln
---

Register CRDT strategy for webhook configs. Deliveries are server-only (not synced).

## Acceptance Criteria

- [ ] Webhook config strategy: LWW-Map in `system-core` document
- [ ] Deliveries are NOT synced (server-authoritative, created by dispatcher)
- [ ] Tests for merge conflict scenarios
