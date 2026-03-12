---
# db-grmv
title: Fix bucket_content_tags entity_type wrong enum
status: completed
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-12T21:24:16Z
parent: db-gwpb
---

entity_type column uses BucketVisibilityScope (9 values) but canonical type specifies EntityType (~50 values). Table cannot represent the canonical type. Change to EntityType; if scope filtering needed, add separate scope column. Ref: audit CR6

## Summary of Changes\n\nNarrowed `bucketContentTags.entityType` from `$type<EntityType>()` (54 values) to `$type<BucketContentEntityType>()` (22 values) matching the DB CHECK constraint. Added `BucketContentEntityType` derived type to `helpers/enums.ts` and exported from package. TypeScript-only change, no migration needed.
