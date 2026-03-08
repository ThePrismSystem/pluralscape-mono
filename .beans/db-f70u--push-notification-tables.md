---
# db-f70u
title: Push notification tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:22:17Z
updated_at: 2026-03-08T19:32:27Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-s6p9
---

Device registration and notification preference tables for push notification delivery.

## Scope

- `device_tokens`: id (UUID PK), account_id (FK → accounts, NOT NULL), platform ('ios'|'android'|'web', T3, NOT NULL), token (varchar, T3, NOT NULL — FCM/APNs token), created_at (T3, NOT NULL, default NOW()), last_used_at (T3, nullable), revoked_at (T3, nullable — timestamp replaces boolean for audit trail)
  - CHECK: `platform IN ('ios', 'android', 'web')`
- `notification_configs`: id, system_id (FK), encrypted_data (T1 — enabled events, quiet hours, friend-specific overrides)
- Indexes: device_tokens (account_id), device_tokens (token unique)
- Design: device tokens are T3 (server must send to push service)
- Design: notification preferences are T1 (what alerts a system wants is private)

### Cascade rules

- Account deletion → CASCADE: device_tokens
- System deletion → CASCADE: notification_configs

## Acceptance Criteria

- [ ] device_tokens table with platform and token
- [ ] notification_configs table with encrypted preferences
- [ ] Indexes for efficient push fan-out
- [ ] Migrations for both dialects
- [ ] Integration test: register device, configure notifications

## References

- features.md section 4 (Push notifications)
- ADR 010 (Background Jobs — push notification fan-out)
- ADR 012 (Full tier push support)
