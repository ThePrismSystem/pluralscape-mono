---
# crypto-t515
title: Mobile key lifecycle specification
status: completed
type: task
priority: critical
created_at: 2026-03-09T12:13:16Z
updated_at: 2026-03-09T12:40:51Z
parent: crypto-gd8f
blocking:
  - ps-7j8n
---

Create a key lifecycle spec for mobile: when MasterKey is derived, where it's stored (Keychain on iOS, Keystore on Android), when it's cleared, app background/foreground transition behavior. Investigate react-native-quick-crypto or native bindings for secure memzero. Current polyfill (buffer.fill(0)) can be optimized away by Hermes. Make this a prerequisite for apps/mobile implementation.

Source: Architecture Audit 004, Fix This Now #3 & Metric 1

## Summary of Changes

- Created mobile key lifecycle spec (`packages/crypto/docs/mobile-key-lifecycle.md`)
- Defines key inventory with storage locations and sensitivity levels
- Specifies 4 MasterKey derivation events (initial login, cold start, password change, recovery)
- App state machine: terminated → locked → unlocked → grace, with transition rules
- Key clearing protocol (derived keys first, MasterKey last)
- Security presets (Convenience/Standard/Paranoid) with configurable timeouts
- Memzero mitigations: NativeMemzero JSI interface, crypto.getRandomValues fallback, buffer reuse pool
- Biometric authentication flow with fail-closed invariant
- Jailbreak/root detection: warn but allow (anti-gatekeeping)
- Added `backgroundGraceSeconds` to `AppLockConfig` in `packages/types/src/settings.ts`
- Updated type test to cover new field
- Defined `KeyLifecycleManager` interface and error types
