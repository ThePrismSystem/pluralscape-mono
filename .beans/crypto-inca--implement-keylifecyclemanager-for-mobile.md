---
# crypto-inca
title: Implement KeyLifecycleManager for mobile
status: completed
type: feature
priority: normal
created_at: 2026-03-09T12:42:47Z
updated_at: 2026-03-15T04:41:08Z
parent: crypto-gd8f
blocked_by:
  - crypto-t515
---

Implement the KeyLifecycleManager interface from packages/crypto/docs/mobile-key-lifecycle.md. Manages app state machine (terminated/locked/unlocked/grace), expo-secure-store integration for MasterKey persistence, biometric authentication flow (fail-closed), key clearing protocol (derived first, MasterKey last), inactivity timeout, background grace timer (backgroundGraceSeconds from AppLockConfig), security presets, lock screen overlay, jailbreak/root detection (warn but allow).

## Summary of Changes

- Added `InvalidStateTransitionError` to `errors.ts` with `from`/`to` state fields
- Added `KeyLifecycleConfig`, `KeyLifecycleDeps`, `SecurityPresetConfig`, `Clock`, `TimerHandle` types to `lifecycle-types.ts`
- Implemented `MobileKeyLifecycleManager` class in `key-lifecycle.ts`:
  - State machine: terminated/locked/unlocked/grace with enforced transitions
  - Password unlock: derives master key via Argon2id, stores in secure storage, derives identity keys
  - Biometric unlock: retrieves master key from secure storage, fail-closed on null
  - Lock: safety-critical clearing order (onBeforeLock -> bucketKeyCache -> identity SKs -> masterKey)
  - Grace period: background -> grace -> lock on timer expiry; foreground cancels timer
  - Inactivity timer: auto-lock after configurable timeout, reset on user activity
  - getBucketKey: splits nonce||ciphertext, decrypts, caches
  - Logout: lock + clear secure storage -> terminated
- Exported `SECURITY_PRESETS` (convenience/standard/paranoid)
- 50 tests covering all state transitions, clearing protocol, timer behavior, and edge cases
