---
# types-ae5n
title: Encryption tier type annotations
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:39Z
updated_at: 2026-03-08T14:21:39Z
parent: types-im7i
blocked_by:
  - types-fid9
  - types-itej
  - types-c2eu
  - types-qryr
  - types-rwnq
  - types-296i
  - types-8klm
  - types-0jjx
  - types-iz5j
  - types-av6x
---

Encrypted<T>, BucketEncrypted<T>, Plaintext<T> generics, EncryptedBlob, tier map for all domain types

Type-level markers mapping every domain field to its encryption tier.

## Scope

- Utility generic types: `Encrypted<T>` (T1 — zero-knowledge), `BucketEncrypted<T>` (T2 — per-bucket), `Plaintext<T>` (T3 — server-visible)
- Encryption tier map: record mapping each domain type + field to its tier
- Reference table (from encryption-research.md section 4.3):
  - T1: member name/pronouns/description/custom fields/avatar, chat content, note content, fronting comments, innerworld data
  - T2: bucket-scoped data shared with friends (same data as T1 but encrypted with bucket key when friend-facing)
  - T3: account info, friend graph, bucket membership, fronting timestamps, webhook metadata
- `EncryptedBlob`: { ciphertext: Uint8Array, nonce: Uint8Array, tier: 1 | 2, keyVersion?: number }
- `PlaintextWrapper<T>`: passthrough for T3 data (identity transformation)

## Acceptance Criteria

- [ ] Encrypted<T> / BucketEncrypted<T> / Plaintext<T> generic types defined
- [ ] EncryptedBlob type with ciphertext, nonce, tier marker
- [ ] Encryption tier map covers ALL domain types from T1.1-T1.9
- [ ] Each field in each type annotated with its tier
- [ ] Type-safe: cannot accidentally pass Encrypted<T> where Plaintext<T> expected
- [ ] Documentation of tier assignments as code comments

## References

- encryption-research.md section 4.3 (Data Encryption Model)
- encryption-research.md section 4.3

## Audit Findings (002)

- Encryption wrappers (Encrypted<T>, BucketEncrypted<T>, Plaintext<T>) are defined but never used by any other types bean — each domain type uses plain strings instead
- Need to define Server/Client type variants: `ServerMember` (encrypted fields are `EncryptedBlob`) vs `ClientMember` (decrypted plain types)
- Need `Decrypt<T>` / `Encrypt<T>` mapping utility types for server-to-client transformation
- Missing `EncryptedString` branded type to prevent accidentally logging/displaying ciphertext
- Missing tier annotations for: API key data, webhook URLs, timer enabled flags, blob metadata
- Convention needed: `T | null` for "value absent but field always present" vs `field?: T` for "field may not exist"
