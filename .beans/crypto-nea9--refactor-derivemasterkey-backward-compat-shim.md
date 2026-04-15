---
# crypto-nea9
title: Refactor deriveMasterKey backward-compat shim
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:25:32Z
updated_at: 2026-04-14T14:53:35Z
parent: ps-4ioj
---

deriveMasterKey retained for key-lifecycle.ts. Refactor MobileKeyLifecycleManager.unlockWithPassword to use derivePasswordKey + unwrapMasterKey pattern.

## Summary of Changes\n\nRefactored MobileKeyLifecycleManager.unlockWithPassword to use derivePasswordKey + unwrapMasterKey (KEK/DEK pattern). Deleted deriveMasterKey entirely. Updated 24 test files.
