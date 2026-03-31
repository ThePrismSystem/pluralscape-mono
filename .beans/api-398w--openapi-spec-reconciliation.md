---
# api-398w
title: OpenAPI spec reconciliation
status: completed
type: task
priority: high
created_at: 2026-03-29T02:58:19Z
updated_at: 2026-03-31T05:11:15Z
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

- [x] Script or systematic process to enumerate all routes from code
- [x] Cross-reference code routes against OpenAPI path entries
- [x] Identify orphaned spec entries (spec has it, code doesn't)
- [x] Identify undocumented endpoints (code has it, spec doesn't)
- [x] Verify request body schemas match Zod schemas for every endpoint
- [x] Verify response schemas match actual response shapes
- [x] Verify error codes per endpoint are complete and accurate
- [x] Verify query/path parameter documentation
- [x] Verify examples are valid
- [x] Fix all discrepancies found
- [x] OpenAPI spec validates cleanly (`openapi-generator validate` or equivalent)

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## Summary of Changes

- Improved validation detection in audit-routes.ts (local schemas, .parse()/.safeParse() patterns)
- Created reconcile-openapi.ts script with path normalization, route diffing, spec parsing, shape comparison
- Added openapi:check CI script (bundle + reconcile)
- Reconciled all route existence discrepancies: 22 orphaned spec entries removed, 12 missing entries added, 24 path structure fixes
- Audited response codes and error documentation across all 39 path files
- Verified flagged validation routes — all 96 validate in the service layer (correct architecture)
- Created follow-up bean api-yxvn for constraint-aware comparison (M10)
