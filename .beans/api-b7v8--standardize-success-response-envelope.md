---
# api-b7v8
title: Standardize success response envelope
status: todo
type: task
created_at: 2026-03-18T20:09:08Z
updated_at: 2026-03-18T20:09:08Z
parent: api-mzn0
---

Standardize success response shapes with { data: T } envelope. Fix pagination duplication in system.service.ts. Create wrapResult/wrapAction helpers.

## TODO

- [ ] Create apps/api/src/lib/response.ts with wrapResult and wrapAction helpers
- [ ] Update ApiResponse type in packages/types/src/results.ts
- [ ] Update sessions.ts response at L85 to use wrapAction
- [ ] Update members/photos/list.ts to use wrapResult
- [ ] Update members/photos/reorder.ts to use wrapResult
- [ ] Update systems/settings/pin/remove-pin.ts to use wrapAction
- [ ] Update systems/settings/pin/set-pin.ts to use wrapAction
- [ ] Replace inline pagination in system.service.ts with buildPaginatedResult
- [ ] Verify fields/list.ts response shape
- [ ] Update OpenAPI spec response schemas
- [ ] Update all affected route tests for new envelope shape
- [ ] Verify: pnpm typecheck && pnpm lint && pnpm vitest run --project api
