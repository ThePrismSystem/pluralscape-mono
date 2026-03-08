---
# crypto-d2tj
title: libsodium cross-platform bindings
status: todo
type: task
priority: critical
created_at: 2026-03-08T13:33:52Z
updated_at: 2026-03-08T13:34:34Z
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

- [ ] libsodium-wrappers-sumo installed and configured
- [ ] react-native-libsodium evaluated and setup documented
- [ ] Unified SodiumWrapper interface defined
- [ ] Platform detection and correct binding selection
- [ ] Initialization with ready-state handling
- [ ] Smoke test: encrypt/decrypt roundtrip on each platform
- [ ] TypeScript types for all used libsodium functions

## Research Notes

- Must use sumo version for crypto_pwhash on web
- react-native-libsodium API matches libsodium-wrappers
- sodium-native available for fastest Node perf (optional optimization)

## References

- ADR 006 (Encryption)
- encryption-research.md section 7
