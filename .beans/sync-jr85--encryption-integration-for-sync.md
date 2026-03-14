---
# sync-jr85
title: Encryption integration for sync
status: completed
type: task
priority: high
created_at: 2026-03-08T13:35:53Z
updated_at: 2026-03-14T20:46:08Z
parent: sync-xlhb
---

Integration of encryption layer with sync protocol (secsync-inspired)

## Scope

- CRDT documents encrypted before transmission to server
- Server stores/relays encrypted CRDT operations (cannot inspect or merge)
- Client workflow: decrypt → apply CRDT merge → re-encrypt
- Document key mapping:
  - System-scoped documents: encrypted with master key
  - Bucket-scoped documents: encrypted with bucket key
- Encrypted snapshot + encrypted updates pattern (secsync model)
- Server enforces monotonic ordering without reading content
- Key exchange: client proves key possession during sync handshake

## Acceptance Criteria

- [x] Encryption/decryption integrated into sync send/receive
- [x] Server never sees plaintext CRDT operations
- [x] Document key mapping to master key or bucket key
- [x] Snapshot + update encryption pattern
- [x] Monotonic ordering enforced server-side
- [x] Integration test: encrypted sync roundtrip

## Research Notes

- secsync is the reference architecture: XChaCha20-Poly1305 encrypted snapshots+updates through "dumb pipe" server
- Use encryption-key boundaries as document boundaries

## References

- ADR 005, ADR 006
- secsync architecture

## Summary of Changes

Implemented the DocumentKeyResolver bridge that maps sync document IDs to the correct encryption keys from the crypto hierarchy.

### New files

- `packages/crypto/src/sync-keys.ts` — `deriveSyncEncryptionKey()` with separate KDF context ("syncdocx") for transport vs storage key isolation
- `packages/sync/src/document-types.ts` — `parseDocumentId()` parser for all 6 document types with time-split suffix detection
- `packages/sync/src/document-key-resolver.ts` — `DocumentKeyResolver` class mapping doc IDs to `DocumentKeys` (master sync key or per-bucket key)

### Test files (39 tests total)

- `sync-keys.test.ts` — 6 tests: determinism, length, context isolation, encrypt/decrypt roundtrip, memzero
- `document-types.test.ts` — 18 tests: all doc types, time-split variants, key type assignment, error cases
- `document-key-resolver.test.ts` — 10 tests: master/bucket key resolution, cross-key isolation, dispose lifecycle
- `encrypted-roundtrip.test.ts` — 5 integration tests: master-key roundtrip, bucket-key roundtrip, cross-key isolation, snapshot roundtrip, multi-device deterministic derivation
