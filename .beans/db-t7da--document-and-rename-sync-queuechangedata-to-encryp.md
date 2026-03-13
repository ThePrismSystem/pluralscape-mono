---
# db-t7da
title: Document and rename sync_queue.changeData to encryptedChangeData
status: completed
type: task
priority: normal
created_at: 2026-03-13T05:00:25Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nRenamed `sync_queue.changeData` → `encryptedChangeData` (PG + SQLite column `change_data` → `encrypted_change_data`). Added JSDoc documenting the ciphertext invariant.
