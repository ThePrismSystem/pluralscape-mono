---
# db-k85r
title: Make blobMetadata.checksum non-nullable
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T00:49:51Z
parent: db-gt84
---

checksum is optional but for a system where no silent data loss is a core value, blob integrity checking should be required. Ref: audit M5

## Summary of Changes

Added `.notNull()` to `blobMetadata.checksum` in both PG and SQLite schemas.
