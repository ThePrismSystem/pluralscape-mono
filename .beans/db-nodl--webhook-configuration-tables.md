---
# db-nodl
title: Webhook configuration tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:41Z
updated_at: 2026-03-09T23:02:20Z
parent: db-2je4
blocked_by:
  - db-9f6f
---

Webhook endpoint configuration and delivery tracking tables.

## Scope

### Tables

- **`webhook_configs`**: id (UUID PK), system_id (FK → systems, NOT NULL), url (varchar, T3, NOT NULL), secret (varchar, T3, NOT NULL — HMAC signing secret for signature verification), events (varchar[] or JSON, T3, NOT NULL), enabled (boolean, T3, NOT NULL, default true), crypto_key_id (FK → api_keys, nullable, T3 — renamed from api_key_id per ADR 013), created_at (T3, NOT NULL, default NOW()), updated_at (T3)
- **`webhook_deliveries`**: id (UUID PK), webhook_id (FK → webhook_configs, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), event_type (varchar, T3, NOT NULL), status ('pending' | 'success' | 'failed', T3, NOT NULL, default 'pending'), http_status (integer, nullable, T3), attempt_count (integer, NOT NULL, default 0), last_attempt_at (T3), next_retry_at (T3, nullable), encrypted_data (T3 — server-generated payload/response logs for debugging; T3 because webhook payloads are server-generated metadata)
  - CHECK: `attempt_count >= 0`
  - CHECK: `http_status BETWEEN 100 AND 599` (when not null)

### Design decisions

- Webhook URLs and event subscriptions are T3 (server must deliver webhooks)
- Delivery logs include encrypted request/response for user debugging
- Retry: exponential backoff, configurable max attempts, dead-letter after exhaustion

### Indexes

- webhook_configs (system_id)
- webhook_deliveries (webhook_id, status)
- webhook_deliveries (next_retry_at) — for retry queue polling

### Cascade rules

- System deletion → CASCADE: webhook_configs
- Webhook config deletion → CASCADE: webhook_deliveries

## Acceptance Criteria

- [ ] webhook_configs with secret for HMAC signing
- [ ] NOT NULL on url
- [ ] DEFAULT: enabled = true, attempt_count = 0, status = 'pending'
- [ ] CHECK: attempt_count >= 0, http_status BETWEEN 100 AND 599
- [ ] updated_at on webhook_configs
- [ ] Migrations for both dialects
- [ ] system_id on webhook_deliveries for RLS
- [ ] crypto_key_id (renamed from api_key_id) on webhook_configs
- [ ] Delivery encrypted_data as T3 (server-generated)
- [ ] Integration test: create config, record delivery with retry

## References

- features.md section 9 (Custom webhooks)
- ADR 010 (Background Jobs — webhook delivery)
