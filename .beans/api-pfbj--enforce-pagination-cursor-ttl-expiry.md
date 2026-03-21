---
# api-pfbj
title: Enforce pagination cursor TTL expiry
status: todo
type: task
priority: normal
created_at: 2026-03-16T09:05:28Z
updated_at: 2026-03-21T10:22:25Z
parent: api-0zl4
blocked_by:
  - api-g954
---

Add 24-hour TTL enforcement for pagination cursors. Expired cursors should return INVALID_CURSOR (400). Use PAGINATION.cursorTtlMs from @pluralscape/types. Per docs/planning/api-specification.md Section 3.
