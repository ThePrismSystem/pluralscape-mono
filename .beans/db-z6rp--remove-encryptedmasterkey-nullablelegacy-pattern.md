---
# db-z6rp
title: Remove encryptedMasterKey nullable/legacy pattern
status: todo
type: task
priority: normal
created_at: 2026-03-24T09:25:32Z
updated_at: 2026-03-24T09:25:32Z
parent: ps-4ioj
---

encryptedMasterKey is nullable with 'legacy accounts' comments but this is pre-production with no legacy accounts. Make NOT NULL.
