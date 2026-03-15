---
# crypto-14ct
title: Implement NativeMemzero JSI module
status: completed
type: task
priority: normal
created_at: 2026-03-09T12:42:43Z
updated_at: 2026-03-15T04:40:56Z
parent: crypto-gd8f
blocked_by:
  - crypto-t515
---

Thin JSI native module for React Native that wraps sodium_memzero (or volatile-qualified zeroing) to provide cryptographically secure memory clearing. Implement NativeMemzero interface from mobile key lifecycle spec. When provided to ReactNativeSodiumAdapter, flips supportsSecureMemzero to true. Needed because buffer.fill(0) can be optimized away by Hermes.

## Summary of Changes

- Created `wrapNativeMemzero(fn)` factory in `packages/crypto/src/adapter/native-memzero.ts`
- Modified `ReactNativeSodiumAdapter` to accept optional `NativeMemzero` via constructor injection
- `supportsSecureMemzero` is now a computed getter (`nativeMemzero !== undefined`)
- `memzero()` delegates to native module when available, falls back to `buffer.fill(0)`
- Added `./native-memzero` export to package.json
- Scaffolded Expo local module at `apps/mobile/modules/native-memzero/`:
  - iOS: `memset_s` (C11 Annex K, compiler cannot elide)
  - Android: volatile-qualified zeroing loop
- Tests: 5 tests for `wrapNativeMemzero`, 4 new tests for adapter injection behavior
