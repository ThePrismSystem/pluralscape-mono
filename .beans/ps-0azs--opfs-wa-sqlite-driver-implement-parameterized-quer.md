---
# ps-0azs
title: "OPFS wa-sqlite driver: implement parameterized query support via prepare/bind/step API"
status: done
type: task
priority: normal
created_at: 2026-04-01T04:13:11Z
updated_at: 2026-04-16T07:15:14Z
parent: ps-0enb
---

The current opfs-sqlite-driver.ts uses wa-sqlite's exec() which doesn't support bind parameters. The run()/all()/get() methods currently ignore params. Implement the lower-level prepare/bind/step API for parameterized queries needed by SqliteStorageAdapter and SqliteOfflineQueueAdapter. Required before the OPFS path can fully replace IndexedDB fallback.

## Summary of Changes

- Added `trackPrepared()` helper using wa-sqlite's prepared statement API: `statements()` -> `bind_collection()` -> `step()` loop -> `row()`/`column_names()`
- Updated `run()`, `all()`, `get()` to delegate to `trackPrepared()` when params are provided, keeping the existing `exec()` path for non-parameterized calls
- Added `toBindParams()` to safely cast unknown params to wa-sqlite compatible types
- Extended `WaSqliteAPI` interface with `statements`, `bind_collection`, `step`, `row`, `column_names` methods and `SQLITE_ROW` constant
- Added 7 new test cases covering: parameterized INSERT/SELECT, multiple params, NULL values, empty results, and `get()` delegation
