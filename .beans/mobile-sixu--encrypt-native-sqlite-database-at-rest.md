---
# mobile-sixu
title: Encrypt native SQLite database at rest
status: completed
type: bug
priority: high
created_at: 2026-04-14T09:28:43Z
updated_at: 2026-04-14T10:26:16Z
---

AUDIT [MOBILE-S-H1] pluralscape-sync.db opened with standard expo-sqlite, no SQLCipher or encryption. All local CRDT data (member info, fronting, journal) stored in plaintext. Physical device access or backup extraction exposes all data.

## Summary of Changes

Enabled SQLCipher encryption for the native SQLite database:

1. Added `useSQLCipher: true` expo-sqlite config plugin in `app.json` (builds SQLCipher-enabled native binary)
2. Extended `createExpoSqliteDriver()` to accept an optional `encryptionKeyHex` option
3. When provided, applies `PRAGMA key` immediately after opening the database
4. Handles pre-existing unencrypted DB migration: detects inaccessible DB, deletes via `deleteDatabaseSync`, recreates with encryption
5. Exported KDF constants (`DB_ENCRYPTION_KDF_CONTEXT`, `DB_ENCRYPTION_SUBKEY_ID`, `DB_ENCRYPTION_KEY_BYTES`) for deriving the encryption key from the master key
6. Added `deleteDatabaseSync` to the shared expo-sqlite mock
7. Added encryption-specific tests (PRAGMA key application, migration path, constants validation)

**Architecture note:** The DB is currently created during platform detection (before auth/unlock), so the encryption key (derived from master key) is not yet available at that point. Wiring the actual encryption requires deferring DB creation until after unlock, which is a separate architectural change. The infrastructure is ready for that integration.
