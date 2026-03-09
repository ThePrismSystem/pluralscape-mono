---
# mobile-inca
title: Implement KeyLifecycleManager for mobile
status: todo
type: feature
priority: normal
created_at: 2026-03-09T12:42:47Z
updated_at: 2026-03-09T12:42:58Z
parent: crypto-gd8f
blocked_by:
  - crypto-t515
---

Implement the KeyLifecycleManager interface from packages/crypto/docs/mobile-key-lifecycle.md. Manages app state machine (terminated/locked/unlocked/grace), expo-secure-store integration for MasterKey persistence, biometric authentication flow (fail-closed), key clearing protocol (derived first, MasterKey last), inactivity timeout, background grace timer (backgroundGraceSeconds from AppLockConfig), security presets, lock screen overlay, jailbreak/root detection (warn but allow).
