---
# api-goa3
title: Add composite index on (system_id, id DESC) for delivery list
status: completed
type: task
priority: low
created_at: 2026-03-29T07:13:17Z
updated_at: 2026-03-29T12:48:12Z
parent: api-kjyg
---

webhook-delivery.service.ts:128 uses cursor pagination with ORDER BY id DESC + WHERE system_id. Combined predicate would benefit from composite index for large tables.
