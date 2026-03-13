---
# db-7qzc
title: Scheduled orphan cleanup job for bucketContentTags
status: completed
type: task
priority: normal
created_at: 2026-03-12T00:50:19Z
updated_at: 2026-03-12T23:51:47Z
---

bucketContentTags.entityId is polymorphic (~40 entity types) and cannot have a DB-level FK. Implement a scheduled job that detects and cleans up orphaned rows where entityId references a deleted entity. Follow-up from db-8bac / db-gt84.

## Summary of Changes

Implemented orphan cleanup query functions (pgCleanupOrphanedTags, sqliteCleanupOrphanedTags, plus all-types wrappers) with ENTITY_TABLE_MAP for 22 entity types and 8 integration tests.
