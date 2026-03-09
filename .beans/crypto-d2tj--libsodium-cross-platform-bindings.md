---
# crypto-d2tj
title: libsodium cross-platform bindings
status: completed
type: task
priority: critical
created_at: 2026-03-08T13:33:52Z
updated_at: 2026-03-09T03:41:49Z
parent: crypto-gd8f
---

libsodium cross-platform bindings setup for packages/crypto

## Scope

- Platform-specific bindings:
  - Bun/Node: `libsodium-wrappers-sumo` (WASM, sumo needed for crypto_pwhash)
  - React Native: `react-native-libsodium` (serenity-kit, JSI bindings) — requires RN 0.83+, New Architecture
  - Web: `libsodium-wrappers-sumo` (same WASM package)
  - Fallback: `noble-sodium` (pure JS, no WASM/native) for environments where WASM isn't available
- Unified wrapper API abstracting platform differences
- Initialization handling: `await sodium.ready` before any crypto operations
- Export all needed primitives through the wrapper

## Acceptance Criteria

- [x] libsodium-wrappers-sumo installed and configured
- [x] react-native-libsodium evaluated and setup documented
- [x] Unified SodiumWrapper interface defined
- [x] Platform detection and correct binding selection
- [x] Initialization with ready-state handling
- [x] Smoke test: encrypt/decrypt roundtrip on each platform
- [x] TypeScript types for all used libsodium functions

## Research Notes

- Must use sumo version for crypto_pwhash on web
- react-native-libsodium API matches libsodium-wrappers
- sodium-native available for fastest Node perf (optional optimization)

## References

- ADR 006 (Encryption)
- encryption-research.md section 7

## Summary of Changes

Implemented the SodiumAdapter pattern in `packages/crypto/src/`:

- `adapter/interface.ts` — SodiumAdapter + SodiumConstants interfaces
- `adapter/wasm-adapter.ts` — libsodium-wrappers-sumo implementation (Bun/Node/Web)
- `adapter/react-native-adapter.ts` — react-native-libsodium implementation with documented gaps
- `sodium.ts` — singleton lifecycle (configureSodium/initSodium/getSodium)
- `errors.ts` — CryptoNotReadyError, DecryptionFailedError, AlreadyInitializedError, UnsupportedOperationError
- `constants.ts` — named libsodium constants
- `types.ts` — AeadResult, CryptoKeypair interfaces
- 9 test files, 80 tests covering AEAD, Box, Sign, Pwhash, KDF, random, init lifecycle
- ADR 006 addendum documenting independent KDF key derivation strategy
- react-native-libsodium added as optional peer dependency
