---
# db-9mj9
title: Add composite FK constraints for tenant ownership
status: completed
type: task
priority: high
created_at: 2026-03-13T13:30:06Z
updated_at: 2026-03-13T13:35:25Z
---

Replace single-column FKs with composite (systemId, accountId) FKs on api_keys, import_jobs, export_requests. Add composite unique on systems(id, accountId) and customFronts(id, systemId). Prevents cross-tenant references at the DB layer.

## Summary of Changes

Added composite unique (id, accountId) on systems table. Replaced single systemId FK with composite (systemId, accountId) FK on api_keys, import_jobs, export_requests. Added composite unique (id, systemId) on custom_fronts. Note: custom_front FK on fronting_sessions kept as single-column due to SET NULL incompatibility with composite FKs.
