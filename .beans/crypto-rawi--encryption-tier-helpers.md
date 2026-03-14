---
# crypto-rawi
title: Encryption tier helpers
status: completed
type: task
priority: high
created_at: 2026-03-08T13:34:16Z
updated_at: 2026-03-14T05:53:14Z
parent: crypto-gd8f
blocked_by:
  - crypto-xbjk
---

High-level encrypt/decrypt helpers for each encryption tier

## Scope

- `encryptTier1<T>(data: T, masterKey: MasterKey): EncryptedBlob` — zero-knowledge encryption
- `decryptTier1<T>(blob: EncryptedBlob, masterKey: MasterKey): T`
- `encryptTier2<T>(data: T, bucketKey: BucketKey): EncryptedBlob` — per-bucket encryption
- `decryptTier2<T>(blob: EncryptedBlob, bucketKey: BucketKey): T`
- `wrapTier3<T>(data: T): T` — identity passthrough for plaintext metadata (type-safe marker)
- JSON serialization built-in (stringify before encrypt, parse after decrypt)
- Type-safe generics: preserves T through encrypt/decrypt cycle
- Batch operations: encrypt/decrypt arrays efficiently

## Acceptance Criteria

- [x] encryptTier1/decryptTier1 roundtrip preserves type T
- [x] encryptTier2/decryptTier2 roundtrip preserves type T
- [x] wrapTier3 is identity function (type marker only)
- [x] JSON serialization handles all domain types
- [x] Batch encrypt/decrypt for arrays
- [x] Type safety: cannot pass T1 blob to T2 decrypt
- [x] Unit tests for each tier with complex domain objects
- [x] Decryption failure handling: wrong key or corrupted data throws typed error (fail-closed, never returns partial/default data)

## References

- encryption-research.md section 4.3 (Data Encryption Model)

## Summary of Changes

Implemented encryption tier helpers in `packages/crypto/src/tiers.ts` with full TDD coverage in `tiers.test.ts` (28 tests).

- T1: KDF-derived sub-key (context: "dataencr", subkey 1) from master key, memzero in finally block
- T2: Direct bucket key encryption with bucketId/keyVersion metadata
- T3: Identity passthrough (wrapTier3)
- Batch operations derive key once for efficiency
- Decrypt functions return `unknown` (callers assert at call site) to satisfy no-unnecessary-type-parameters lint rule
- All functions exported from barrel index.ts
