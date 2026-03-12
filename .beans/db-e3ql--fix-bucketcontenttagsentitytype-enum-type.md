---
# db-e3ql
title: Fix bucketContentTags.entityType enum type
status: scrapped
type: bug
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T21:24:16Z
parent: db-gwpb
---

DB types as BucketVisibilityScope, canonical type is EntityType. Already tracked in CR6 — this is the type-level symptom. Ref: audit M24

## Reasons for Scrapping\n\nDuplicate of db-grmv. Both describe the same root cause: `bucketContentTags.entityType` using `$type<EntityType>()` instead of the narrower bucket-content subset. Fixed in db-grmv.
