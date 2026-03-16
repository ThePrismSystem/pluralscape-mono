---
# api-77rx
title: Restructure error handler to new ApiErrorResponse format
status: todo
type: task
priority: normal
created_at: 2026-03-16T09:05:21Z
updated_at: 2026-03-16T11:32:44Z
parent: ps-rdqo
blocked_by:
  - api-g954
---

Migrate error-handler.ts from { error: string } to the standardized { error: { code, message, details? }, requestId } shape defined in docs/planning/api-specification.md Section 2. Add requestId (UUIDv7) generation. Implement privacy rule: 401/403 -> NOT_FOUND for entity lookups. Import error codes from @pluralscape/types API_ERROR_CODES.
