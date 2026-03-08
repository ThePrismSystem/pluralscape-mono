---
# types-p24v
title: System settings types
status: todo
type: task
created_at: 2026-03-08T14:25:15Z
updated_at: 2026-03-08T14:25:15Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

Per-system settings and preferences types.

## Scope

- `SystemSettings`: systemId, theme (ThemePreference), fontScale (number), defaultBucketId (BucketId | null), notificationPrefs (NotificationPreferences), appLock (AppLockConfig), littlesSafeMode (LittlesSafeModeConfig ref)
- `ThemePreference`: 'light' | 'dark' | 'high-contrast' | 'system'
- `AppLockConfig`: pinEnabled (boolean), biometricEnabled (boolean), lockTimeout (number — minutes)
- `NotificationPreferences`: local notification settings (distinct from push notification config)

## Acceptance Criteria

- [ ] SystemSettings type covering all per-system preferences
- [ ] Theme, font scale, app lock config
- [ ] Default privacy bucket reference
- [ ] Unit tests for settings validation

## References

- features.md section 13 (Accessibility and UX)
- features.md section 14 (PIN code / biometric lock)
