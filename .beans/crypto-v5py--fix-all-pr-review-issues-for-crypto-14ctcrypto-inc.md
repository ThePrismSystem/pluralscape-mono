---
# crypto-v5py
title: Fix all PR review issues for crypto-14ct/crypto-inca
status: completed
type: task
priority: normal
created_at: 2026-03-15T05:13:39Z
updated_at: 2026-03-15T05:21:57Z
---

Fix all 19 issues (3 critical, 9 important, 7 suggested) from PR #114 review across 8 files: errors.ts, lifecycle-types.ts, index.ts, NativeMemzeroModule.kt, NativeMemzeroModule.swift, key-lifecycle.test.ts, key-lifecycle.ts, native-memzero/src/index.ts

## Summary of Changes

Fixed all 19 review issues from PR #114:

- **I12**: Narrowed InvalidStateTransitionError.from/to from string to KeyLifecycleState
- **S13**: Removed unused SecurityPresetConfig interface and export
- **S14/S17**: Updated TimerHandle and key getter JSDoc for accuracy
- **C1/I10**: Switched Android NativeMemzero from ByteArray to TypedArray for direct JSI buffer access
- **I7/S18**: Added assert for memset_s return value in iOS; shortened nativeMemzeroFn JSDoc
- **I8**: Tests for getMasterKey/getIdentityKeys/getBucketKey during grace state
- **I9**: Tests for logout from locked, terminated, and grace states
- **S16**: Fixed clearing-order test to use buffer identity instead of length matching
- **S19**: Test for inactivity timer restart after foreground return
- **C2**: lock()/logout() now re-throw onBeforeLock errors after state transition
- **C3**: Replaced void this.lock() with .catch() in timer callbacks
- **I4**: Added assertKdfMasterKey validation in unlockWithBiometric
- **I5**: Replaced assertKeysAvailable() with inline null narrowing (removes unsafe casts)
- **I6**: Key material zeroed in catch block if storage.store fails
- **I11**: Collapsed redundant onBackground if/else branches
- **S15**: Extracted teardownKeys() to deduplicate lock/logout logic
