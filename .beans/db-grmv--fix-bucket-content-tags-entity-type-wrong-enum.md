---
# db-grmv
title: Fix bucket_content_tags entity_type wrong enum
status: todo
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-11T04:47:30Z
parent: db-2je4
---

entity_type column uses BucketVisibilityScope (9 values) but canonical type specifies EntityType (~50 values). Table cannot represent the canonical type. Change to EntityType; if scope filtering needed, add separate scope column. Ref: audit CR6
