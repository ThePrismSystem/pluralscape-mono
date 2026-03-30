---
# api-y9zq
title: Add cursor pagination to field value list endpoints
status: completed
type: task
priority: high
created_at: 2026-03-30T06:58:10Z
updated_at: 2026-03-30T08:04:00Z
parent: api-e7gt
---

Field value lists for members/groups/structure entities return a simple {items} array without cursor/limit pagination. With up to 200 fields per entity (per spec), this could be problematic. Add cursor-based pagination consistent with other list endpoints.

## Summary of Changes

Added cursor-based pagination to all three field value list endpoints (member, group, structure entity). Response shape changed from `{items}` to `{items, nextCursor, hasMore, totalCount}` using the standard `buildPaginatedResult` helper with limit+1 fetch pattern. Added `fieldDefinitionId` filter support. Constants: default limit 50, max limit 200.
