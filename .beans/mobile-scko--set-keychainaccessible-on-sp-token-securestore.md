---
# mobile-scko
title: Set keychainAccessible on SP token SecureStore
status: todo
type: bug
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T09:22:51Z
parent: mobile-e3l7
---

Finding [HIGH-1] from audit 2026-04-20. apps/mobile/src/features/import-sp/sp-token-storage.ts:34-37. SecureStore.setItemAsync with no options inherits AFTER_FIRST_UNLOCK — readable while device locked and may be included in iCloud/Google encrypted backups. Fix: add { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }.
