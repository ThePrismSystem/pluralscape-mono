---
# db-f70u
title: Push notification tables
status: todo
type: task
created_at: 2026-03-08T14:22:17Z
updated_at: 2026-03-08T14:22:17Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-s6p9
---

Device registration and notification preference tables for push notification delivery.

## Scope

- `device_tokens`: id, account_id (FK), platform ('ios'|'android'|'web'), token (varchar — T3, FCM/APNs token), created_at, last_used_at, revoked (boolean)
- `notification_configs`: id, system_id (FK), encrypted_data (T1 — enabled events, quiet hours, friend-specific overrides)
- Indexes: device_tokens (account_id), device_tokens (token unique)
- Design: device tokens are T3 (server must send to push service)
- Design: notification preferences are T1 (what alerts a system wants is private)

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
