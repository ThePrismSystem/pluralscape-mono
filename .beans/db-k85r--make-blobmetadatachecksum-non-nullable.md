---
# db-k85r
title: Make blobMetadata.checksum non-nullable
status: todo
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T19:39:45Z
parent: db-gt84
---

checksum is optional but for a system where no silent data loss is a core value, blob integrity checking should be required. Ref: audit M5
