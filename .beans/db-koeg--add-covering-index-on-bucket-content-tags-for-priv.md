---
# db-koeg
title: Add covering index on bucket_content_tags for privacy hot path
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T07:21:36Z
parent: db-2nr7
---

Current (entity_type, entity_id) index does not include bucket_id as covering column, forcing heap fetch. Add INCLUDE (bucket_id). Ref: audit M27

## Summary of Changes\n\nDropped redundant `bucket_content_tags_entity_idx` — the composite PK already covers (entity_type, entity_id) queries.
