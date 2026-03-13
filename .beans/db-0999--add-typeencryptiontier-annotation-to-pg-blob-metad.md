---
# db-0999
title: Add $type<EncryptionTier> annotation to PG blob_metadata.encryptionTier
status: completed
type: task
priority: normal
created_at: 2026-03-13T05:00:25Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nAdded `.$type<EncryptionTier>()` to PG `blob_metadata.encryptionTier` column, matching the existing SQLite annotation.
