---
# api-ibn2
title: API consistency normalization
status: in-progress
type: task
priority: high
created_at: 2026-03-29T02:59:27Z
updated_at: 2026-03-30T11:08:49Z
parent: api-e7gt
blocked_by:
  - api-g475
---

Normalize API surface for consistency. Pre-release — breaking changes are fine.

## Scope

### Naming Conventions

- Verify all response fields use consistent casing (camelCase)
- Verify all query parameters use consistent casing
- Verify all path segments use consistent kebab-case
- Verify all error codes use consistent SCREAMING_SNAKE_CASE
- Verify all operation IDs in OpenAPI follow consistent pattern

### Response Shape Consistency

- All single-resource responses use the same envelope (or none)
- All list responses use the same pagination shape (`{ data, nextCursor, hasMore }`)
- All error responses use `{ error: { code, message, details }, requestId }`
- All create endpoints return the created resource with 201
- All update endpoints return the updated resource with 200
- All delete endpoints return 204 (no body) or consistent shape
- All not-found cases return 404 with `NOT_FOUND` code

### HTTP Status Code Consistency

- 200 for success (read/update)
- 201 for created
- 204 for deleted (no content)
- 400 for validation errors
- 401 for unauthenticated
- 403 for unauthorized
- 404 for not found
- 409 for conflict (has dependents, duplicate)
- 429 for rate limited
- No misused status codes

### Pagination Consistency

- All list endpoints use cursor-based pagination
- All support `cursor` and `limit` query params
- All enforce consistent max limit (100)
- All return `nextCursor` and `hasMore`

### Idempotency

- PUT/PATCH operations are idempotent
- DELETE operations are idempotent (204 even if already deleted, or consistent 404)
- POST operations that should be idempotent use idempotency keys or are naturally idempotent

## Checklist

- [ ] Audit response field casing across all endpoints
- [ ] Audit query/path parameter naming
- [ ] Audit error code naming
- [ ] Audit response envelope consistency
- [ ] Audit HTTP status code usage
- [ ] Audit pagination shape consistency
- [ ] Audit idempotency behavior
- [ ] Fix all inconsistencies found
- [ ] Update OpenAPI spec to reflect changes

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.
