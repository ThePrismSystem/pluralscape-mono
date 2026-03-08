---
# crypto-rawi
title: Encryption tier helpers
status: todo
type: task
priority: high
created_at: 2026-03-08T13:34:16Z
updated_at: 2026-03-08T13:35:46Z
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

- [ ] encryptTier1/decryptTier1 roundtrip preserves type T
- [ ] encryptTier2/decryptTier2 roundtrip preserves type T
- [ ] wrapTier3 is identity function (type marker only)
- [ ] JSON serialization handles all domain types
- [ ] Batch encrypt/decrypt for arrays
- [ ] Type safety: cannot pass T1 blob to T2 decrypt
- [ ] Unit tests for each tier with complex domain objects
- [ ] Decryption failure handling: wrong key or corrupted data throws typed error (fail-closed, never returns partial/default data)

## References

- encryption-research.md section 4.3 (Data Encryption Model)
