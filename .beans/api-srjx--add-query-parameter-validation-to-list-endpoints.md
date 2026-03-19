---
# api-srjx
title: Add query parameter validation to list endpoints
status: completed
type: task
priority: normal
created_at: 2026-03-18T20:09:20Z
updated_at: 2026-03-19T00:44:54Z
parent: api-mzn0
---

Add Zod schema validation for all unvalidated query parameters on list endpoints. Create reusable schemas in packages/validation.

## TODO

- [ ] Create packages/validation/src/query-params.ts with Zod schemas
- [ ] Export new schemas from packages/validation/src/index.ts
- [ ] Add eventType validation to lifecycle-events/list.ts
- [ ] Add memberId validation to relationships/list.ts
- [ ] Replace unsafe cast in innerworld/entities/list.ts with Zod parse
- [ ] Add filter param validation to structure-links/index.ts (3 handlers)
- [ ] Add include_archived validation to members/list.ts
- [ ] Add include_archived validation to fields/list.ts
- [ ] Add include_archived validation to blobs/list.ts
- [ ] Add includeArchived validation to innerworld/regions/list.ts
- [ ] Add validation unit tests for new schemas
- [ ] Update route tests to verify 400 on malformed params
- [ ] Verify: pnpm typecheck && pnpm lint && pnpm vitest run --project api --project validation
