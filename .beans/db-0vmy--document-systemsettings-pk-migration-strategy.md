---
# db-0vmy
title: Document systemSettings PK migration strategy
status: completed
type: task
priority: normal
created_at: 2026-03-12T01:39:46Z
updated_at: 2026-03-13T00:05:55Z
---

systemSettings PK changed from systemId to id, and littlesSafeModeEnabled moved to encrypted data. Migration path for existing rows needs documentation before the schema ships.

## Migration Steps

The migration must be executed as a single transaction:

1. For every existing `system_settings` row, read `littles_safe_mode_enabled` and encrypt it into the `encrypted_data` blob alongside other settings fields using the system's master key
2. Add the `id` column (surrogate UUID primary key, generated per-row)
3. Drop the old `system_id` primary key constraint and replace with a `UNIQUE NOT NULL` constraint on `system_id`
4. Set `id` as the new primary key
5. Drop the `littles_safe_mode_enabled` column

If encryption fails for any row, the entire transaction must roll back. The migration runner should verify that every row's `encrypted_data` blob contains the `littlesSafeModeEnabled` field before dropping the column.

## Summary of Changes

Created docs/migrations/system-settings-pk.md covering:

- Background on PK change (systemId -> surrogate id) and littlesSafeModeEnabled move to encrypted_data
- Pre/post migration state with SQL examples
- 5-step single-transaction migration procedure
- PG and SQLite-specific migration scripts
- Rollback strategy
- Verification steps
- Self-hosted deployment considerations
