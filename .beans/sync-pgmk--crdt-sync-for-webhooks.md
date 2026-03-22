---
# sync-pgmk
title: CRDT sync for webhooks
status: todo
type: task
priority: normal
created_at: 2026-03-22T11:49:38Z
updated_at: 2026-03-22T12:51:03Z
parent: api-i8ln
blocked_by:
  - api-a40k
---

Register CRDT strategy for webhook configs. Deliveries are server-only (not synced).

## Acceptance Criteria

- [ ] Webhook config strategy: LWW-Map in `system-core` document
- [ ] Deliveries are NOT synced (server-authoritative, created by dispatcher)
- [ ] Post-merge validation: webhook config validates URL format (HTTPS in production), `event_types` against `WebhookEventType` enum
- [ ] Tests for merge conflict scenarios
