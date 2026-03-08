---
# types-gey6
title: Push notification types
status: todo
type: task
created_at: 2026-03-08T14:23:50Z
updated_at: 2026-03-08T14:23:50Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Push notification configuration, delivery, and device token types.

## Scope

- `DeviceToken`: id, accountId, platform ('ios'|'android'|'web'), token (string), createdAt, lastUsedAt, revoked (boolean)
- `NotificationConfig`: id, systemId, enabledEvents (NotificationEventType[]), quietHoursStart (time string | null), quietHoursEnd (time string | null)
- `NotificationEventType`: 'switch' | 'fronting-start' | 'fronting-end' | 'message-received' | 'acknowledgement-requested'
- `NotificationPayload`: eventType, timestamp, data (T3 metadata only — no encrypted content in push payloads)
- `NotificationPreference`: per-friend override settings

## Acceptance Criteria

- [ ] DeviceToken with platform and revocation
- [ ] NotificationConfig with event filtering and quiet hours
- [ ] NotificationPayload as T3-only (no encrypted content in pushes)
- [ ] Unit tests for config validation

## References

- features.md section 4 (Push notifications)
- ADR 010 (Background Jobs — push notification fan-out)
