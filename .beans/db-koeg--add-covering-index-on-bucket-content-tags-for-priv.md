---
# db-koeg
title: Add covering index on bucket_content_tags for privacy hot path
status: todo
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-11T19:40:19Z
parent: db-2nr7
---

Current (entity_type, entity_id) index does not include bucket_id as covering column, forcing heap fetch. Add INCLUDE (bucket_id). Ref: audit M27
