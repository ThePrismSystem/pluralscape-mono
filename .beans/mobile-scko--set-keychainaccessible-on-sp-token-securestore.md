---
# mobile-scko
title: Set keychainAccessible on SP token SecureStore
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T18:50:37Z
parent: mobile-e3l7
---

Finding [HIGH-1] from audit 2026-04-20. apps/mobile/src/features/import-sp/sp-token-storage.ts:34-37. SecureStore.setItemAsync with no options inherits AFTER_FIRST_UNLOCK — readable while device locked and may be included in iCloud/Google encrypted backups. Fix: add { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }.

## Summary of Changes

Set keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY on every SecureStore call in apps/mobile/src/features/import-sp/sp-token-storage.ts (setItemAsync, getItemAsync on get()/hasToken(), and deleteItemAsync). The SP token is no longer readable while the device is locked and is excluded from iCloud Keychain sync and cross-device encrypted-backup restores.

Hardened options are applied for parity across read/write/delete calls even though iOS binds the accessibility class at write time — keeps intent obvious and guards against future platform changes that might expose per-call overrides.

Tests: added four keychainAccessible assertion cases to sp-token-storage.test.ts (one per SecureStore method). Extended the shared expo-secure-store mock with per-method option capture so the assertions observe the options actually passed. Added the keychain-accessibility constants to the inline mock in import.hooks.test.tsx.

Scope note: expo-secure-token-store.ts (auth session token) already sets WHEN_UNLOCKED_THIS_DEVICE_ONLY; no other SecureStore secret needed an update in this bean.
