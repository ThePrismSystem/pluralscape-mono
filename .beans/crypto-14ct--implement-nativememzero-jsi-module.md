---
# crypto-14ct
title: Implement NativeMemzero JSI module
status: todo
type: task
priority: normal
created_at: 2026-03-09T12:42:43Z
updated_at: 2026-03-09T12:42:58Z
parent: crypto-gd8f
blocked_by:
  - crypto-t515
---

Thin JSI native module for React Native that wraps sodium_memzero (or volatile-qualified zeroing) to provide cryptographically secure memory clearing. Implement NativeMemzero interface from mobile key lifecycle spec. When provided to ReactNativeSodiumAdapter, flips supportsSecureMemzero to true. Needed because buffer.fill(0) can be optimized away by Hermes.
