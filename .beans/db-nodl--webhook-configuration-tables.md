---
# db-nodl
title: Webhook configuration tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:41Z
updated_at: 2026-03-08T14:03:41Z
parent: db-2je4
blocked_by:
  - db-9f6f
---

Webhook endpoint configuration and delivery tracking tables

## Scope

- `webhook_configs`: id, system_id, url (varchar — T3, needed for server delivery), events (varchar[] or JSON — T3, needed for event filtering), enabled (boolean — T3), api_key_id (FK nullable — T3), created_at (T3)
- `webhook_deliveries`: id, webhook_id (FK), event_type (varchar — T3), status ('pending' | 'success' | 'failed' — T3), http_status (integer nullable), attempt_count (integer), last_attempt_at (T3), next_retry_at (T3 nullable), encrypted_data (T1 — request/response body for debugging)
- Design: webhook URLs and event subscriptions are T3 (server must read them to deliver webhooks)
- Design: delivery logs include encrypted request/response for user debugging
- Indexes: webhook_configs (system_id), webhook_deliveries (webhook_id, status)
- Retry: exponential backoff, max 5 attempts, dead-letter after exhaustion

## Acceptance Criteria

- [ ] webhook_configs table with URL and event subscriptions
- [ ] webhook_deliveries table with retry tracking
- [ ] Optional crypto key assignment for encrypted payloads
- [ ] Indexes for efficient delivery queue queries
- [ ] Migrations for both dialects
- [ ] Integration test: create config, record delivery attempt

## References

- features.md section 9 (Custom webhooks)
- ADR 010 (Background Jobs — webhook delivery)
