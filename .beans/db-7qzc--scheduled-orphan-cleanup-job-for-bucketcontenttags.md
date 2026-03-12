---
# db-7qzc
title: Scheduled orphan cleanup job for bucketContentTags
status: todo
type: task
created_at: 2026-03-12T00:50:19Z
updated_at: 2026-03-12T00:50:19Z
---

bucketContentTags.entityId is polymorphic (~40 entity types) and cannot have a DB-level FK. Implement a scheduled job that detects and cleans up orphaned rows where entityId references a deleted entity. Follow-up from db-8bac / db-gt84.
