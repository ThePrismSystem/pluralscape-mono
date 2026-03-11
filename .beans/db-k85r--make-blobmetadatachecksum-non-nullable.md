---
# db-k85r
title: Make blobMetadata.checksum non-nullable
status: todo
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

checksum is optional but for a system where no silent data loss is a core value, blob integrity checking should be required. Ref: audit M5
