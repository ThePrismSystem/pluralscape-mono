---
# api-l33a
title: "Fix PR #241 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-22T16:47:03Z
updated_at: 2026-04-16T07:29:47Z
parent: ps-mmpz
---

Address all critical, important, and suggestion-level findings from PR review

## Summary of Changes

### Critical

- Added `archived = false` filter to all 3 queries in `validateSubjectIds` — archived members/custom fronts/structure entities can no longer be used as subjects

### Important

- Fixed OpenAPI comment ID prefix: `fsc_` → `fcom_` (10 occurrences across 5 endpoints)
- Added `includeArchived` support to `listFrontingComments` (service + route + validation schema + OpenAPI was already correct)
- Fixed OpenAPI archive response codes: session and comment archive now correctly document 204 (matching implementation)
- Fixed comment cursor pagination: changed `orderBy` from `desc(createdAt)` to `desc(id)` to match cursor logic

### Suggestions

- `isCofronting` now only counts member/structure-entity sessions (custom fronts excluded)
- `deleteFrontingSession` now only counts non-archived comments as dependents
- `listFrontingComments` and `getFrontingComment` now verify parent session exists (returns clear 404)
- Consolidated triple import in `validate-subject-ids.ts`
- Added detection strategy comment to post-merge validator

### Tests

- New `validate-subject-ids.test.ts` with 10 test cases
- Added `includeArchived` tests to comments-crud route tests
- Added custom-front cofronting edge case test to active fronting route tests
