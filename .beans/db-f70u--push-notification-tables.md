---
# db-f70u
title: Push notification tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:22:17Z
updated_at: 2026-03-09T23:02:01Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-s6p9
---

Device registration and notification preference tables for push notification delivery.

## Scope

- `device_tokens`: id (UUID PK), account_id (FK → accounts, NOT NULL), system_id (FK → systems, NOT NULL), platform ('ios'|'android'|'web', T3, NOT NULL), token (varchar, T3, NOT NULL — FCM/APNs token), created_at (T3, NOT NULL, default NOW()), last_used_at (T3, nullable), revoked_at (T3, nullable — timestamp replaces boolean for audit trail)
  - CHECK: `platform IN ('ios', 'android', 'web')`
- `notification_configs`: id (UUID PK), system_id (FK → systems, NOT NULL), event_type (varchar, T3, NOT NULL — one row per event type), enabled (boolean, T3, NOT NULL, default true), channels (varchar[] or JSON, T3 — push/email/in-app), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, nullable — quiet hours override, custom settings)
  - Unique: (system_id, event_type)
- `friend_notification_preferences`: id (UUID PK), system_id (FK → systems, NOT NULL), friend_connection_id (FK → friend_connections, NOT NULL), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — per-friend notification overrides: muteAll, muteFrontUpdates, customSound)
  - Unique: (system_id, friend_connection_id)
- Indexes: device_tokens (account_id), device_tokens (system_id), device_tokens (token unique), notification_configs (system_id), friend_notification_preferences (system_id)
- Design: device tokens are T3 (server must send to push service)
- Design: notification preferences are T1 (what alerts a system wants is private)

### Cascade rules

- Account deletion → CASCADE: device_tokens
- System deletion → CASCADE: notification_configs, friend_notification_preferences
- Friend connection deletion → CASCADE: friend_notification_preferences

## Acceptance Criteria

- [ ] device_tokens table with platform and token
- [ ] system_id on device_tokens for tenant isolation
- [ ] notification_configs restructured as per-event-type rows
- [ ] friend_notification_preferences table for per-friend overrides
- [ ] Indexes for efficient push fan-out
- [ ] Migrations for both dialects
- [ ] Integration test: register device, configure notifications

## References

- features.md section 4 (Push notifications)
- ADR 010 (Background Jobs — push notification fan-out)
- ADR 012 (Full tier push support)
