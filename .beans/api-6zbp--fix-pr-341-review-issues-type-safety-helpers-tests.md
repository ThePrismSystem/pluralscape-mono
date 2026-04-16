---
# api-6zbp
title: "Fix PR #341 review issues: type safety, helpers, tests"
status: completed
type: task
priority: normal
created_at: 2026-03-31T05:34:18Z
updated_at: 2026-04-16T07:29:50Z
parent: ps-n8uk
---

Address 2 important issues and 8 suggestions from PR #341 code review on OpenAPI spec reconciliation script.

## Tasks

- [x] Import HttpMethod and use across reconcile-openapi.ts
- [x] Add runtime guards in extractInlineShape allOf loop
- [x] Replace chained as casts with getJsonBodySchema helper
- [x] Add OpenApiType union for FieldShape.type
- [x] Extract execAllMatches regex helper in audit-routes.ts
- [x] Move API_BASE_PATH to module-level constant
- [x] Add SCHEMA_USAGE_PATTERN false-positive comment
- [x] Add missing test cases in reconcile-openapi.test.ts
- [x] Run verification (typecheck, lint, tests)

## Summary of Changes

- Imported `HttpMethod` from audit-routes and used it across `RouteKey`, `SpecOperation`, `RouteShapeMismatch`
- Added `OpenApiType` union type for `FieldShape.type` with set-based validation
- Added `ShapeMap` type alias replacing 7 occurrences of `Record<string, FieldShape>`
- Added runtime guards in `extractInlineShape` allOf loop (typeof/null checks instead of unsafe cast)
- Extracted `getJsonBodySchema` helper replacing chained `as` casts in `parseSpecOperations`
- Extracted `execAllMatches` regex helper in audit-routes.ts, refactored 3 functions to use it
- Moved `API_BASE_PATH` to module-level constant with JSDoc
- Added false-positive trade-off comment on `SCHEMA_USAGE_PATTERN`
- Added 4 new test cases: allOf with $ref, empty allOf, non-object allOf entry, shapeMismatches in JSON output
- All 59 tests pass, typecheck clean, lint clean
