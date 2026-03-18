---
# api-uo5a
title: Add unit tests for lib utilities and blob infrastructure
status: completed
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:58:51Z
parent: api-i2pw
---

Untested: occ-update.ts, validate-encrypted-blob.ts, system-ownership.ts, assert-system-ownership.ts, member-helpers.ts, blob-usage-query.ts, blob-archiver.ts, orphan-blob-query.ts, storage.ts, pagination.ts, valkey-store.ts. Ref: audit T-7, T-8.

## Test Files

- [ ] `apps/api/src/__tests__/lib/occ-update.test.ts` — assertOccUpdated
  - Returns single row when update affected exactly one row
  - Throws 409 CONFLICT when update returned 0 rows but entity still exists (version mismatch)
  - Throws 404 NOT_FOUND when update returned 0 rows and entity no longer exists
  - Handles edge case: update returned multiple rows (should not happen but test defensive behavior)

- [ ] `apps/api/src/__tests__/lib/validate-encrypted-blob.test.ts` — validateEncryptedBlob
  - Returns EncryptedBlob for valid base64 data
  - Throws 400 for invalid base64 encoding
  - Throws 400 when decoded bytes exceed MAX_ENCRYPTED_DATA_BYTES
  - Throws 400 when deserialization to EncryptedBlob fails

- [ ] `apps/api/src/__tests__/lib/system-ownership.test.ts` — assertSystemOwnership (DB-backed)
  - Resolves when system exists, owned by auth account, not archived
  - Throws 404 when system not found (never 403, to avoid revealing existence)
  - Throws 404 when system owned by different account
  - Throws 404 when system is archived

- [ ] `apps/api/src/__tests__/lib/assert-system-ownership.test.ts` — assertSystemOwnership (in-memory)
  - No-op when auth.systemId matches requested systemId
  - Throws 403 FORBIDDEN when auth.systemId doesn't match

- [ ] `apps/api/src/__tests__/lib/member-helpers.test.ts` — assertMemberActive, assertFieldDefinitionActive
  - assertMemberActive: resolves when member exists, belongs to system, not archived
  - assertMemberActive: throws 404 when member not found / wrong system / archived
  - assertFieldDefinitionActive: resolves when field def exists, belongs to system, not archived
  - assertFieldDefinitionActive: throws 404 when field def not found / wrong system / archived

- [ ] `apps/api/src/__tests__/lib/blob-usage-query.test.ts` — BlobUsageQueryImpl
  - getUsedBytes: returns sum of sizeBytes for non-archived confirmed blobs
  - getUsedBytes: returns 0 when no blobs exist for system
  - Filters out archived blobs and unconfirmed (pending) blobs

- [ ] `apps/api/src/__tests__/lib/blob-archiver.test.ts` — BlobArchiverImpl
  - archiveByStorageKey: sets archived=true and archivedAt on matching blob
  - Idempotent: archiving already-archived blob succeeds silently
  - No-op when storageKey not found (no error thrown)

- [ ] `apps/api/src/__tests__/lib/orphan-blob-query.test.ts` — OrphanBlobQueryImpl
  - findOrphanedKeys: returns storage keys of pending blobs older than cutoff
  - Returns empty array when no orphans exist
  - Only returns blobs that are pending (never confirmed/uploaded)
  - Respects olderThanMs threshold (recent pending blobs excluded)

- [ ] `apps/api/src/__tests__/lib/storage.test.ts` — getStorageAdapter, initStorageAdapter, getQuotaService
  - getStorageAdapter: throws when not initialized
  - initStorageAdapter: sets adapter, subsequent getStorageAdapter returns it
  - initStorageAdapter: throws on double init (already initialized)
  - setStorageAdapterForTesting: overrides adapter for tests
  - \_resetStorageAdapterForTesting: clears adapter
  - getQuotaService: returns BlobQuotaService wrapping BlobUsageQueryImpl

- [ ] `apps/api/src/__tests__/lib/pagination.test.ts` — parsePaginationLimit
  - Returns parsed number when valid string within range
  - Returns defaultLimit for undefined input
  - Returns defaultLimit for non-numeric string
  - Clamps to maxLimit when parsed value exceeds max
  - Clamps to 1 when parsed value is 0 or negative
  - Handles edge cases: float strings, whitespace

- [ ] `apps/api/src/__tests__/middleware/stores/valkey-store.test.ts` — createValkeyStore only
  - Successfully creates ValkeyRateLimitStore when connection succeeds
  - Returns null when ioredis connection fails (graceful fallback)
  - Dynamic import of ioredis (variable indirection to avoid compile-time resolution)
  - NOTE: ValkeyRateLimitStore.increment already tested in rate-limit-store.test.ts — only test createValkeyStore factory

## Implementation Notes

- Pattern: `__tests__/services/member.service.test.ts` for DB-dependent tests (use mockDb helper)
- occ-update, system-ownership, member-helpers, blob-usage-query, blob-archiver, orphan-blob-query all need mockDb()
- assert-system-ownership (in-memory) and pagination need NO DB mock — pure function tests
- validate-encrypted-blob: mock @pluralscape/crypto (deserializeEncryptedBlob)
- storage.ts: use \_resetStorageAdapterForTesting in afterEach for cleanup
- valkey-store createValkeyStore: mock dynamic import of ioredis module

## Summary of Changes

Created 11 test files:

- apps/api/src/**tests**/lib/occ-update.test.ts (4 tests)
- apps/api/src/**tests**/lib/validate-encrypted-blob.test.ts (4 tests)
- apps/api/src/**tests**/lib/system-ownership.test.ts (4 tests)
- apps/api/src/**tests**/lib/assert-system-ownership.test.ts (3 tests)
- apps/api/src/**tests**/lib/member-helpers.test.ts (7 tests)
- apps/api/src/**tests**/lib/blob-usage-query.test.ts (3 tests)
- apps/api/src/**tests**/lib/blob-archiver.test.ts (2 tests)
- apps/api/src/**tests**/lib/orphan-blob-query.test.ts (3 tests)
- apps/api/src/**tests**/lib/storage.test.ts (5 tests)
- apps/api/src/**tests**/lib/pagination.test.ts (9 tests)
- apps/api/src/**tests**/middleware/stores/valkey-store-factory.test.ts (2 tests)

All 46 tests pass.
