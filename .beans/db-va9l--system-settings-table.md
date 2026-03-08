---
# db-va9l
title: System settings table
status: todo
type: task
created_at: 2026-03-08T14:22:58Z
updated_at: 2026-03-08T14:22:58Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

General per-system settings and preferences table (distinct from nomenclature_settings).

## Scope

- `system_settings`: system_id (FK, PK — 1:1 with systems), encrypted_data (T1 — dark mode, font scaling, default privacy bucket, notification prefs, other UI prefs), pin_hash (varchar nullable — T3, Argon2id hash for app lock), biometric_enabled (boolean default false — T3), littles_safe_mode_enabled (boolean default false — T3)
- Design: PIN hash is T3 (server may verify for web sessions). Most settings are T1 (private).
- Design: 1:1 with systems table (like nomenclature_settings)
- Indexes: none beyond PK (single row per system)

## Acceptance Criteria

- [ ] system_settings table with system_id as PK
- [ ] PIN hash stored server-side for app lock
- [ ] Littles safe mode flag as T3 (server may need for API behavior)
- [ ] Encrypted preferences blob for private settings
- [ ] Migrations for both dialects
- [ ] Integration test: set and retrieve settings

## References

- features.md section 13 (Accessibility and UX)
- features.md section 14 (PIN code / biometric lock)
