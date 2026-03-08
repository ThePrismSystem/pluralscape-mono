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

- `SystemSettings`: systemId, theme (ThemePreference), fontScale (number), locale (Locale | null), defaultBucketId (BucketId | null), notificationPrefs (NotificationPreferences), appLock (AppLockConfig), littlesSafeMode (LittlesSafeModeConfig ref), nomenclatureRef (reference to NomenclatureSettings), syncPreferences (SyncPreferences), privacyDefaults (PrivacyDefaults)
- `ThemePreference`: 'light' | 'dark' | 'high-contrast' | 'system'
- `AppLockConfig`: pinEnabled (boolean), biometricEnabled (boolean), lockTimeout (number — in minutes)
- `NotificationPreferences`: local notification settings (distinct from push notification config)
- `SyncPreferences`: syncEnabled (boolean), syncOnCellular (boolean)
- `PrivacyDefaults`: defaultBucketForNewContent (BucketId | null), friendRequestPolicy ('open' | 'code-only')

## Acceptance Criteria

- [ ] SystemSettings type covering all per-system preferences
- [ ] Theme, font scale, locale, app lock config
- [ ] lockTimeout documented as minutes
- [ ] nomenclatureRef linking to NomenclatureSettings
- [ ] syncPreferences and privacyDefaults
- [ ] Default privacy bucket reference
- [ ] Unit tests for settings validation

## References

- features.md section 13 (Accessibility and UX)
- features.md section 14 (PIN code / biometric lock)
