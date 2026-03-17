---
# api-wni4
title: Custom field values per member
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:56:42Z
updated_at: 2026-03-17T21:35:42Z
parent: api-b0nb
blocked_by:
  - api-ysx4
  - api-ossk
---

POST .../members/:memberId/fields/:fieldDefId (set value). GET all values for member. PUT update. DELETE remove. Validate value matches field definition type. Unique per (fieldDefId, memberId).

## Summary of Changes\n\nImplemented field values per member: set (POST), list (GET, not paginated), update (PUT with OCC), delete (DELETE, hard delete). Unique constraint per (fieldDefId, memberId).
