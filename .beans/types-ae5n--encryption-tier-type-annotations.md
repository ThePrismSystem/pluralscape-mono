---
# types-ae5n
title: Encryption tier type annotations
status: completed
type: task
priority: high
created_at: 2026-03-08T13:32:39Z
updated_at: 2026-03-09T02:02:54Z
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

Type-level markers mapping every domain field to its encryption tier, plus server/client type variant patterns.

## Scope

### Wrapper generics

- `Encrypted<T>` (T1 — zero-knowledge): wraps fields the server cannot read
- `BucketEncrypted<T>` (T2 — per-bucket): wraps fields shared with friends via bucket keys
- `Plaintext<T>` (T3 — server-visible): passthrough wrapper for explicit tier annotation

### EncryptedBlob

- `EncryptedBlob`: { ciphertext: Uint8Array, nonce: Uint8Array, tier: 1 | 2, algorithm: string (for crypto agility), keyVersion?: number, bucketId?: BucketId (for T2 blobs) }

### EncryptedString branded type

- `EncryptedString`: branded string type to prevent accidentally logging or displaying ciphertext

### Server/Client type variant pattern

Define a convention for distinguishing server-side (encrypted) from client-side (decrypted) representations:

- `ServerMember`: encrypted_data is an EncryptedBlob — what the server stores/returns
- `ClientMember`: flat decrypted fields (name, pronouns, etc.) — what the client works with
- `EncryptedMemberData` / `DecryptedMemberData`: the inner data shape before/after decryption
- Pattern applies to all domain types with encrypted_data columns

### Mapping utility types

- `Decrypt<ServerT, ClientT>`: maps a server type to its client-side equivalent
- `Encrypt<ClientT, ServerT>`: maps a client type to its server-side equivalent

### Encryption tier map

Record mapping each domain type + field to its tier (from encryption-research.md section 4.3):

- T1: member name/pronouns/description/custom fields/avatar, chat content, note content, fronting comments, innerworld data, lifecycle event details
- T2: bucket-scoped data shared with friends (same data as T1 but encrypted with bucket key)
- T3: account info, friend graph, bucket membership, fronting timestamps, webhook metadata, API key scopes, timer enabled flags, blob storage keys

## Acceptance Criteria

- [x] Encrypted<T> / BucketEncrypted<T> / Plaintext<T> generic types defined
- [x] EncryptedBlob with ciphertext, nonce, tier, algorithm, optional bucketId
- [x] EncryptedString branded type to prevent logging ciphertext
- [x] Server/Client pairs for Member, FrontingSession, Group, Subsystem, Relationship
- [x] DecryptFn<ServerT, ClientT> and EncryptFn<ClientT, ServerT> mapping utility types
- [x] Encryption tier map covers completed domain types (partial — TODOs for remaining)
- [x] Type-safe: phantom brand prevents Encrypted/BucketEncrypted/Plaintext interchange
- [x] Documentation of tier assignments as code comments

## References

- encryption-research.md section 4.3 (Data Encryption Model)

## Cross-Bean Adoption

All domain type beans with encrypted data MUST define Server/Client type variant pairs and annotate fields with tier wrappers. Beans needing variants: types-fid9, types-itej, types-8klm, types-puxp, types-rwnq, types-iz5j, types-0jjx, types-c2eu, types-qryr, types-xmsf, types-jawp, types-p24v, types-gey6.

## Summary of Changes

Implemented encryption tier framework with Encrypted<T>, BucketEncrypted<T>, Plaintext<T> phantom-branded wrappers. Added EncryptedBlob wire format and EncryptedString branded type. Defined Server/Client pairs for 5 completed domains (Member, FrontingSession, Group, Subsystem, Relationship). Added DecryptFn/EncryptFn mapping utility types. Scope is partial — TODOs left for communication, custom fields, innerworld, and lifecycle event types.
