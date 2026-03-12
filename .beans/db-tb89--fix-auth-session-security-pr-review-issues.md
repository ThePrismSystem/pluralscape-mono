---
# db-tb89
title: Fix auth session security PR review issues
status: completed
type: task
priority: normal
created_at: 2026-03-12T03:34:43Z
updated_at: 2026-03-12T03:36:01Z
---

Address PR review feedback: add CHECK constraints (sessions expiresAt, deviceTransferRequests key material), partial indexes (sessions, recoveryKeys), domain type updates, CI migration gating, and integration tests.

## Summary of Changes

### Schema (PG + SQLite)

- Added CHECK constraint on sessions: `expires_at IS NULL OR expires_at > created_at`
- Added CHECK constraint on device_transfer_requests: `status \!= 'approved' OR encrypted_key_material IS NOT NULL`
- Converted sessions.expires_at index to partial (PG only): `WHERE expires_at IS NOT NULL`
- Converted recovery_keys.revoked_at index to partial (PG only): `WHERE revoked_at IS NULL`

### Domain Types

- Added `expiresAt: UnixMillis | null` to Session interface
- Added `revokedAt: UnixMillis | null` to RecoveryKey interface

### Tests

- Extracted magic number constants (ONE_DAY_MS, ONE_HOUR_MS)
- Added CHECK constraint rejection tests for sessions and device_transfer_requests
- Added UPDATE lifecycle tests (expiresAt, revokedAt, encryptedKeyMaterial)
- Added 4 type-level assertions for new nullable columns
- Updated DDL helpers with CHECKs, partial indexes, and recoveryKeysIndexes

### CI

- Migration freshness job now depends on lint + typecheck

### Skipped

- tsx removal (Step 2): drizzle-kit cannot resolve .js extension TS imports without tsx
