---
# crypto-15l0
title: "Implement PR #114 review fixes"
status: completed
type: task
priority: normal
created_at: 2026-03-15T05:50:44Z
updated_at: 2026-03-15T05:54:34Z
---

Address 4 bugs and 10 suggestions from multi-agent review of PR #114 (MobileKeyLifecycleManager + NativeMemzero)

## Summary of Changes

1. Made `assertKdfMasterKey` a TS assertion function — removes 2 unnecessary casts
2. Typed `salt` parameter as `PwhashSalt` throughout lifecycle types and implementation
3. Added `onLockError` callback to `KeyLifecycleDeps` — surfaces timer-triggered lock errors
4. Fixed `unlockWithBiometric` state corruption — memzeros on `deriveIdentityKeys` failure
5. Fixed `logout()` error loss — preserves both errors when `onBeforeLock` and `clearAll` throw
6. Changed iOS `assert` to `precondition` for release-build safety
7. Removed redundant `cancelInactivityTimer` call in `onUserActivity`
8. Updated JSDoc for `onBackground`, `onForeground`, and memzero polyfill
9. Added 9 new tests covering grace-state biometric, bucket key negatives, timer lock errors, requireBiometric passthrough, state corruption fix, and logout double-throw
