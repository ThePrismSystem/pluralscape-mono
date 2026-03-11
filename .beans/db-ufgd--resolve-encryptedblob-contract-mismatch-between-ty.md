---
# db-ufgd
title: Resolve EncryptedBlob contract mismatch between types, crypto, and DB
status: completed
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-11T05:37:39Z
parent: db-2je4
---

types/encryption.ts defines EncryptedBlob as structured envelope (ciphertext, nonce, tier, algorithm, keyVersion, bucketId). DB stores raw Uint8Array. crypto/symmetric.ts returns {ciphertext, nonce} separately. No codec bridges these. Pick one format, document nonce storage convention. Ref: audit CR2

## Tasks

- [x] Create blob-codec.ts with serialize/deserialize functions
- [x] Create blob-codec.test.ts with round-trip and edge case tests
- [x] Re-export from crypto/index.ts
- [x] Create pgEncryptedBlob custom column type
- [x] Create sqliteEncryptedBlob custom column type
- [x] Update all ~20 schema files to use new column types for encryptedData
- [x] Update DDL in test helpers
- [x] Verify all tests pass

## Summary of Changes

Created binary codec (`packages/crypto/src/blob-codec.ts`) that serializes/deserializes `EncryptedBlob ↔ Uint8Array` with a versioned wire format. Created `pgEncryptedBlob` and `sqliteEncryptedBlob` custom Drizzle column types that wrap the codec. Updated all ~32 schema files (16 PG + 16 SQLite) to use the new column types for `encryptedData` columns. Updated all ~38 test files to pass `EncryptedBlob` objects via `testBlob()` helper. All 956 db tests and 253 crypto tests pass.
