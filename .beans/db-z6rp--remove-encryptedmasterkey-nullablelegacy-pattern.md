---
# db-z6rp
title: Remove encryptedMasterKey nullable/legacy pattern
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:25:32Z
updated_at: 2026-04-14T14:53:47Z
parent: ps-4ioj
---

encryptedMasterKey is nullable with 'legacy accounts' comments but this is pre-production with no legacy accounts. Make NOT NULL.

## Summary of Changes\n\nMade encryptedMasterKey NOT NULL in PG and SQLite auth schemas. Removed legacy null-guard branches in account and recovery-key services. Updated types.
