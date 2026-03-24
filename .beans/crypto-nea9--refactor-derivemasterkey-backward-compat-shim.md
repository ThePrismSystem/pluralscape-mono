---
# crypto-nea9
title: Refactor deriveMasterKey backward-compat shim
status: todo
type: task
priority: normal
created_at: 2026-03-24T09:25:32Z
updated_at: 2026-03-24T09:25:32Z
parent: ps-4ioj
---

deriveMasterKey retained for key-lifecycle.ts. Refactor MobileKeyLifecycleManager.unlockWithPassword to use derivePasswordKey + unwrapMasterKey pattern.
