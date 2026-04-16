---
# api-x7z0
title: "Fix all PR #150 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-17T06:08:06Z
updated_at: 2026-04-16T07:29:43Z
parent: ps-rdqo
---

Address 10 review issues from PR #150: type-safe parseIdParam via IdPrefixBrandMap, limit validation in list route, branded service params, toCursor helper, simplified tests, benchmark failure counter, and migration regen.

## Summary of Changes\n\n- Added `IdPrefixBrandMap` interface to `@pluralscape/types` mapping all 55 prefix literals to brand tags\n- Added `toCursor()` helper to `@pluralscape/types` for safe branded-ID-to-cursor casts\n- Made `parseIdParam` type-safe via `IdPrefixBrandMap` constraint (no manual generics needed)\n- Updated system route handlers (get/delete/update) to use `ID_PREFIXES.system` instead of string literals and removed redundant casts\n- Fixed NaN/negative/zero limit handling in `list.ts` (mirrors sessions pattern)\n- Tightened `listSystems()` parameters to `AccountId` and `PaginationCursor` branded types\n- Replaced double-cast `as string as PaginationCursor` with `toCursor()`\n- Simplified `id-param.test.ts` try/catch pattern to `expect.objectContaining`\n- Added 3 new limit validation tests and cursor forwarding test\n- Added cursor-path service-layer test\n- Added failure counter to registration timing benchmark\n- Regenerated PG and SQLite migrations
