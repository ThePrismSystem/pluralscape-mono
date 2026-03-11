---
# db-8bac
title: Fix bucket_content_tags polymorphic entityId with no FK
status: todo
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-11T04:47:30Z
parent: db-2je4
---

entityId references whichever table entityType names but no FK exists. Entity deletion does not cascade to content tags. Under fail-closed privacy principle, stale tags on deleted entities create fail-open privacy risk. Ref: audit CR10
