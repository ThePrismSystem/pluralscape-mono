---
# db-ly0u
title: "Fix PR #50 review findings for batch 4b DB schema"
status: completed
type: task
priority: high
created_at: 2026-03-10T06:02:35Z
updated_at: 2026-04-16T07:29:38Z
parent: db-2nr7
---

Address 7 issues from multi-model review of PR #50 (groups, innerworld, PK bridge schema):

1. Add timestamps/versioned to innerworldCanvas
2. Add unique constraint on pk_bridge_state.system_id
3. Add $type<readonly string[]>() to gatekeeperMemberIds
4. Fix PG groups test string interpolation
5. Add error pattern matching to PG .rejects.toThrow()
6. Add missing PG pk-bridge tests (FK rejection + enabled:false)
7. Fix PGlite instantiation inconsistency

## Summary of Changes

1. Added `timestamps()` and `versioned()` mixins to `innerworldCanvas` table (PG + SQLite schemas, DDL helpers, tests)
2. Changed `pk_bridge_state.system_id` index from `index` to `uniqueIndex` (PG + SQLite schemas, DDL helpers); fixed test that relied on non-unique index
3. Added `.$type<readonly string[]>()` to `gatekeeperMemberIds` JSONB column (PG + SQLite schemas)
4. Fixed string interpolation to parameterized query in PG groups test
5. Skipped PG `.rejects.toThrow()` pattern matching (PGlite wraps errors as 'Failed query:...' losing constraint type info)
6. Added two missing PG pk-bridge tests: FK rejection + enabled:false round-trip
7. Fixed PGlite instantiation: `new PGlite()` -> `await PGlite.create()`; removed unused `PGliteType` type import
