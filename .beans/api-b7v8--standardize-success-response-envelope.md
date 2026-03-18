---
# api-b7v8
title: Standardize success response envelope
status: in-progress
type: task
priority: normal
created_at: 2026-03-18T20:09:08Z
updated_at: 2026-03-18T23:15:11Z
parent: api-mzn0
---

Standardize success response shapes with { data: T } envelope. Fix pagination duplication in system.service.ts. Create wrapResult/wrapAction helpers.

## TODO

- [x] Create apps/api/src/lib/response.ts with wrapResult and wrapAction helpers
- [x] Update ApiResponse type in packages/types/src/results.ts
- [x] Update sessions.ts response at L85 to use wrapAction
- [x] Update members/photos/list.ts to use wrapResult
- [x] Update members/photos/reorder.ts to use wrapResult
- [x] Update systems/settings/pin/remove-pin.ts to use wrapAction
- [x] Update systems/settings/pin/set-pin.ts to use wrapAction
- [x] Replace inline pagination in system.service.ts with buildPaginatedResult
- [x] Verify fields/list.ts response shape
- [x] Update OpenAPI spec response schemas
- [x] Update all affected route tests for new envelope shape
- [x] Verify: pnpm typecheck && pnpm lint && pnpm vitest run --project api

## PR Review Fixes

- [x] Fix ApiResponse truthiness narrowing: `resp.data` → `resp.data !== undefined`
- [x] Add `{ success?: never }` constraint to wrapAction overloads
- [x] Change wrapAction guard from `if (details)` to `if (details !== undefined)`
- [x] Fix OpenAPI setPin status code: 201 → 200
- [x] Fix OpenAPI photo reorder HTTP method: post → put
- [x] Add negative type test: ApiResponse rejects both data and error
- [x] Add edge-case tests: wrapAction({}), wrapResult(undefined)
- [x] Add type-level tests for wrapAction overload inference
- [x] Fix route test type casts: success: boolean → success: true
- [x] Migrate setup wizard routes to data envelope (status, nomenclature, profile, complete)
- [x] Update setup route tests for data envelope assertions
- [x] Update OpenAPI spec for setup routes (status, nomenclature, profile, complete)
