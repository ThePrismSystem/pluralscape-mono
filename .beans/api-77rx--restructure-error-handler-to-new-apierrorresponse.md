---
# api-77rx
title: Restructure error handler to new ApiErrorResponse format
status: completed
type: task
priority: normal
created_at: 2026-03-16T09:05:21Z
updated_at: 2026-03-16T12:57:45Z
parent: ps-rdqo
blocked_by:
  - api-g954
---

Migrate error-handler.ts from { error: string } to the standardized { error: { code, message, details? }, requestId } shape defined in docs/planning/api-specification.md Section 2. Add requestId (UUIDv7) generation. Implement privacy rule: 401/403 -> NOT_FOUND for entity lookups. Import error codes from @pluralscape/types API_ERROR_CODES.

## Summary of Changes\n\n- Added `ApiErrorResponse` type to `@pluralscape/types` (results.ts)\n- Created `request-id.ts` middleware generating UUIDv4 per request with `X-Request-Id` header\n- Created `ApiHttpError` class (`lib/api-error.ts`) for structured error throwing\n- Rewrote `error-handler.ts` to return `{ error: { code, message, details? }, requestId }` envelope\n- Added HTTP status-to-ApiErrorCode mapping (400→VALIDATION_ERROR, 401→UNAUTHENTICATED, etc.)\n- Production masking: 5xx errors get generic message and stripped details\n- Rewrote all error handler tests for new response shape
