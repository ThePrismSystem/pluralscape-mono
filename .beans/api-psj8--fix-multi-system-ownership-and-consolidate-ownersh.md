---
# api-psj8
title: Fix multi-system ownership and consolidate ownership modules
status: completed
type: bug
priority: critical
created_at: 2026-03-18T07:12:32Z
updated_at: 2026-03-18T07:57:39Z
parent: api-i2pw
---

Three ownership modules exist (assert-system-ownership.ts, system-ownership.ts, verify-system-ownership.ts). The in-memory assertSystemOwnership sets auth.systemId from first system via leftJoin, breaking multi-system accounts. Consolidate into one module, use DB-backed verification everywhere, fix 403->404 for fail-closed privacy. Ref: audit S-2, S-5, P-1, S-13.

## Todo Items\n\n- [x] Rewrite system-ownership.ts to use PostgresJsDatabase\n- [x] Delete assert-system-ownership.ts\n- [x] Delete verify-system-ownership.ts\n- [x] Update audit-writer.ts and audit-log.ts DB types to PostgresJsDatabase\n- [x] Migrate 14 sync-assert services to DB-backed assert\n- [x] Migrate 4 verify services to assertSystemOwnership\n- [x] Update Category A tests (9 files — mock path/name changes)\n- [x] Update Category B tests (14 files — add mocks, fix 403→404)\n- [x] Update remaining test files (audit-writer, route tests)\n- [x] Run full test suite: pnpm vitest run --project api\n- [x] Verify no remaining references to deleted files

## Summary of Changes

Consolidated three ownership modules into one DB-backed `assertSystemOwnership` in `system-ownership.ts`. Deleted `assert-system-ownership.ts` (sync in-memory check, 403) and `verify-system-ownership.ts` (duplicate DB-backed). Updated all 18 importing services and 18 test files. Changed audit-writer.ts and audit-log.ts from `PgDatabase<PgQueryResultHKT>` to `PostgresJsDatabase`. All 1105 tests pass (2 pre-existing middleware timeouts unrelated).
