---
# api-b7v8
title: Standardize success response envelope
status: in-progress
type: task
priority: normal
created_at: 2026-03-18T20:09:08Z
updated_at: 2026-03-18T20:12:57Z
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
