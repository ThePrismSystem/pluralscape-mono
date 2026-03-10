---
# db-va9l
title: System settings table
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:22:58Z
updated_at: 2026-03-10T02:54:54Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

General per-system settings and preferences table (distinct from nomenclature_settings).

## Scope

### Tables

- **`system_settings`**: system_id (FK → systems, PK — 1:1), version (integer, T3, NOT NULL, default 1), locale (varchar, T3, nullable — BCP 47 tag for server-side localization), pin_hash (varchar, T3, nullable — Argon2id hash for app lock), biometric_enabled (boolean, T3, NOT NULL, default false), littles_safe_mode_enabled (boolean, T3, NOT NULL, default false), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — darkMode, fontScaling, defaultPrivacyBucketId, syncPreferences, privacyDefaults, onboardingComplete, saturationLevelsEnabled, autoEndFrontingSessions, frontingHistoryRetentionDays, defaultFrontingPositionality, timeFormat, dateFormat, weekStartDay, enabledFeatures)

### Design decisions

- PIN hash is T3 (server may verify for web sessions). Most settings are T1 (private).
- 1:1 with systems table (like nomenclature_settings)
- locale is T3 so server can localize server-generated content (emails, push notifications)

## Acceptance Criteria

- [x] version for CRDT, created_at/updated_at
- [x] system_settings table with system_id as PK
- [x] locale column for user locale preference
- [x] PIN hash stored server-side for app lock
- [x] Littles safe mode flag as T3
- [x] All settings fields explicitly enumerated in encrypted_data (onboardingComplete, saturationLevelsEnabled, etc.)
- [x] Encrypted preferences blob for private settings
- [x] Migrations for both dialects
- [x] Integration test: set and retrieve settings

## References

- features.md section 13 (Accessibility and UX)
- features.md section 14 (PIN code / biometric lock)
- features.md section 11 (i18n — locale preference)

## Summary of Changes

Implemented `system_settings` table (PG + SQLite) with system_id as PK (1:1), locale, pin_hash, biometric_enabled, littles_safe_mode_enabled, encrypted_data, version, timestamps. 9 integration tests.
