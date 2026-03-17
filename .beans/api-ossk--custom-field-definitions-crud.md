---
# api-ossk
title: Custom field definitions CRUD
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:56:42Z
updated_at: 2026-03-17T21:35:42Z
parent: api-b0nb
blocked_by:
  - api-o89k
---

POST /systems/:systemId/fields (field type discriminant, name, options for select/multi-select, required flag, sortOrder). GET list. PUT update. Archive/restore. System-scoped.

## Summary of Changes\n\nImplemented field definition CRUD: create (POST), list (GET, cursor-paginated), get (GET), update (PUT with OCC), archive (DELETE), restore (POST). Max 200 definitions per system.
