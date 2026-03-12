---
# db-8bac
title: Fix bucket_content_tags polymorphic entityId with no FK
status: completed
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-12T00:50:12Z
parent: db-gt84
---

entityId references whichever table entityType names but no FK exists. Entity deletion does not cascade to content tags. Under fail-closed privacy principle, stale tags on deleted entities create fail-open privacy risk. Ref: audit CR10

## Summary of Changes

No code changes. `bucketContentTags.entityId` is polymorphic across ~40 entity types. Per-type junction tables are impractical. The limitation is documented and a follow-up bean (db-level orphan cleanup job) will be created.
