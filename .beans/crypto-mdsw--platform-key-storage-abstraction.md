---
# crypto-mdsw
title: Platform key storage abstraction
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:34:20Z
updated_at: 2026-03-14T09:35:45Z
parent: crypto-gd8f
blocked_by:
  - crypto-d2tj
---

Platform-specific secure key storage interface

## Scope

- Interface: `SecureKeyStorage { store(keyId: string, key: Uint8Array, opts: KeyStorageOpts): Promise<void>, retrieve(keyId: string): Promise<Uint8Array | null>, delete(keyId: string): Promise<void>, requiresBiometric(): boolean }`
- `KeyStorageOpts`: { requireBiometric: boolean, accessibility: 'afterFirstUnlock' | 'whenUnlocked' }
- iOS stub: Keychain Services with Secure Enclave, biometric gating (implementation in apps/mobile)
- Android stub: Android Keystore with StrongBox, biometric gating (implementation in apps/mobile)
- Web implementation: in-memory Map (cleared on tab close, no persistence)
- Note: actual native implementations live in apps/mobile; this defines the interface and web fallback

## Acceptance Criteria

- [x] SecureKeyStorage interface defined and exported
- [x] Web implementation (in-memory) complete
- [x] iOS/Android stubs with implementation notes
- [x] Biometric requirement flag
- [x] Accessibility options for iOS
- [x] Unit test: web implementation store/retrieve/delete
- [x] Clear-all method for session teardown

## References

- encryption-research.md sections 2, 5

## Summary of Changes

Defined SecureKeyStorage interface and KeyStorageOpts type in key-storage.ts. Implemented createWebKeyStorage() backed by Map with memzero-on-remove semantics and copy semantics for store/retrieve. 19 tests passing.
