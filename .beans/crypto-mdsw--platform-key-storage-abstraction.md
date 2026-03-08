---
# crypto-mdsw
title: Platform key storage abstraction
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:34:20Z
updated_at: 2026-03-08T13:35:44Z
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

- [ ] SecureKeyStorage interface defined and exported
- [ ] Web implementation (in-memory) complete
- [ ] iOS/Android stubs with implementation notes
- [ ] Biometric requirement flag
- [ ] Accessibility options for iOS
- [ ] Unit test: web implementation store/retrieve/delete
- [ ] Clear-all method for session teardown

## References

- encryption-research.md sections 2, 5
