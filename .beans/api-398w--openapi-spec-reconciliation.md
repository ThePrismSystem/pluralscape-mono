---
# api-398w
title: OpenAPI spec reconciliation
status: todo
type: task
priority: high
created_at: 2026-03-29T02:58:19Z
updated_at: 2026-03-29T03:03:12Z
parent: api-e7gt
blocked_by:
  - api-g475
  - api-sojx
  - api-69ul
  - api-3b2d
  - api-ibn2
---

Audit every REST route against its OpenAPI definition. Fix all drift.

## Scope

Systematic comparison of every route handler in `apps/api/src/routes/` against `docs/openapi.yaml` + `docs/openapi/paths/*.yaml`. This is a line-by-line reconciliation — not a spot check.

For every endpoint, verify:

- Path, method, and operation ID exist in spec
- Request body schema matches Zod validation schema exactly
- All query/path parameters documented with correct types and constraints
- Response schemas match actual response shapes (success + every error code)
- Error codes documented match what the error handler actually returns
- Examples are valid and match current schemas
- Required vs. optional fields are accurate
- Content-Type headers (request + response) are correct

Also verify the reverse:

- No orphaned spec entries for endpoints that were removed or renamed
- No undocumented endpoints in code

## Checklist

- [ ] Script or systematic process to enumerate all routes from code
- [ ] Cross-reference code routes against OpenAPI path entries
- [ ] Identify orphaned spec entries (spec has it, code doesn't)
- [ ] Identify undocumented endpoints (code has it, spec doesn't)
- [ ] Verify request body schemas match Zod schemas for every endpoint
- [ ] Verify response schemas match actual response shapes
- [ ] Verify error codes per endpoint are complete and accurate
- [ ] Verify query/path parameter documentation
- [ ] Verify examples are valid
- [ ] Fix all discrepancies found
- [ ] OpenAPI spec validates cleanly (`openapi-generator validate` or equivalent)

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.
