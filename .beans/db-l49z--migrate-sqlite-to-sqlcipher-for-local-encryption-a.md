---
# db-l49z
title: Migrate SQLite to SQLCipher for local encryption-at-rest
status: completed
type: task
priority: high
created_at: 2026-03-12T11:20:43Z
updated_at: 2026-03-13T13:46:38Z
---

Migrated from better-sqlite3 to better-sqlite3-multiple-ciphers for SQLCipher encryption-at-rest support. Per ADR 006, production and mobile deployments encrypt the local SQLite database at rest via SQLITE_ENCRYPTION_KEY env var.

## Implementation

- [x] Replace `better-sqlite3` with `better-sqlite3-multiple-ciphers` (drop-in superset, SQLCipher 4.x, AES-256)
- [x] Add `encryptionKey` option to `SqliteConfig` and `createDatabase()` factory
- [x] Issue `PRAGMA cipher='sqlcipher'` and `PRAGMA key` when key provided
- [x] Validate hex-encoded key format (even-length hex string)
- [x] Read key from `SQLITE_ENCRYPTION_KEY` env var in `createDatabaseFromEnv()`
- [x] Add encryption round-trip test (encrypted write, raw open fails, keyed open succeeds)
- [x] Add key validation tests (non-hex, odd-length)
- [x] Update ADR 018 to reflect SQLCipher as implemented
- [x] All existing tests pass (drop-in compatible)
