---
# crypto-mp96
title: Per-bucket key management
status: todo
type: task
priority: high
created_at: 2026-03-08T13:34:02Z
updated_at: 2026-03-08T13:35:46Z
parent: crypto-gd8f
blocked_by:
  - crypto-xbjk
---

Per-bucket symmetric key generation, storage, and rotation

## Scope

- `generateBucketKey(): BucketKey` — random 256-bit symmetric key
- `encryptBucketKey(bucketKey: BucketKey, masterKey: MasterKey): EncryptedBlob` — for owner storage
- `decryptBucketKey(blob: EncryptedBlob, masterKey: MasterKey): BucketKey`
- Key rotation: `rotateBucketKey(oldKey: BucketKey): { newKey: BucketKey, reEncrypt: (data: EncryptedPayload) => EncryptedPayload }`
- Key versioning: each bucket key has a version number, incremented on rotation
- DEK/KEK envelope pattern: bucket key (DEK) wrapped by master key (KEK)
- In-memory key cache: decrypted bucket keys cached per session

## Acceptance Criteria

- [ ] Random bucket key generation (256-bit)
- [ ] Bucket key encrypt/decrypt with master key
- [ ] Key rotation generates new key and re-encryption helper
- [ ] Key versioning tracked
- [ ] In-memory cache interface (set/get/clear)
- [ ] Unit test: generate → encrypt → rotate → re-encrypt flow
- [ ] Unit test: old key cannot decrypt data encrypted with new key

## Research Notes

- DEK/KEK envelope: KEK rotation only re-wraps DEKs (cheap)
- On revocation: rotate DEK, background-job re-encrypts existing data
- Keep old DEK read-only until re-encryption completes

## References

- ADR 006 section 4.1, 4.4
- encryption-research.md section 4
