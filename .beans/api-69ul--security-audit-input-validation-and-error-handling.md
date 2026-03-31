---
# api-69ul
title: 'Security audit: input validation and error handling'
status: completed
type: task
priority: critical
created_at: 2026-03-29T02:58:57Z
updated_at: 2026-03-30T22:44:48Z
parent: api-e7gt
---

In-depth audit of input validation coverage and error handling safety across every endpoint.

## Scope

### Input Validation

- Every endpoint accepting a request body has a Zod schema
- Every path parameter is validated (type, format, length)
- Every query parameter is validated (type, range, allowed values)
- No raw `req.body` access without prior validation
- String length limits on all text fields (prevent storage abuse)
- Array length limits on all array fields
- Numeric range validation on all numeric fields
- Regex patterns on format-constrained fields (hex strings, UUIDs, etc.)
- Content-Type enforcement (reject unexpected content types)
- File upload validation (size, type, count) on blob endpoints

### Injection Prevention

- No raw SQL construction (verify Drizzle ORM used consistently)
- No template injection in any string interpolation
- No header injection via user-controlled values
- No path traversal in blob/file operations
- WebSocket message validation

### Error Handling Safety

- No stack traces leaked in production error responses
- No internal state leaked in error details (table names, query text, file paths)
- 5xx errors are generic in production (`INTERNAL_ERROR` only)
- 4xx errors provide actionable detail without leaking internals
- Consistent error envelope: `{ error: { code, message, details }, requestId }`
- Every error code in the codebase is documented
- Unhandled promise rejections are caught (global handler)

### Denial of Service Prevention

- Request body size limits enforced globally
- Pagination limits enforced (no unbounded queries)
- No N+1 query patterns on list endpoints
- No user-controlled recursion depth
- Regex patterns are not vulnerable to ReDoS

## Checklist

- [x] Enumerate all endpoints and their validation schemas
- [x] Identify endpoints missing Zod validation
- [x] Verify path/query param validation on every endpoint
- [x] Verify string/array/numeric limits on all schemas
- [x] Verify Content-Type enforcement
- [x] Audit for raw SQL or template injection
- [x] Audit for path traversal in blob operations
- [x] Verify error response format consistency
- [x] Verify no information leakage in error responses
- [x] Verify body size and pagination limits
- [x] Audit regex patterns for ReDoS
- [x] Fix all issues found

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.


## Summary of Changes

Full audit completed. All services use Zod validation. Path params consistently use requireIdParam(). No raw SQL or injection vectors. Error masking correct in production. Pagination enforced with HMAC cursor integrity.

Fixes applied:
- Content-Type enforcement added to parseJsonBody (415 UNSUPPORTED_MEDIA_TYPE)
- Max-length constraints added to unconstrained query param strings (note.ts, audit-log-query.ts)

Audit report: docs/local-audits/015-api-security-audit-2026-03-30.md
