---
# ps-0azs
title: "OPFS wa-sqlite driver: implement parameterized query support via prepare/bind/step API"
status: completed
type: task
priority: normal
created_at: 2026-04-01T04:13:11Z
updated_at: 2026-04-16T22:28:22Z
parent: ps-0enb
blocked_by:
  - mobile-shr0
---

The current opfs-sqlite-driver.ts uses wa-sqlite's exec() which doesn't support bind parameters. The run()/all()/get() methods currently ignore params. Implement the lower-level prepare/bind/step API for parameterized queries needed by SqliteStorageAdapter and SqliteOfflineQueueAdapter. Required before the OPFS path can fully replace IndexedDB fallback.

## Partial Implementation (Scoped Down)

PR #459 review (multi-agent) found that the original implementation silently violated the synchronous `SqliteStatement` contract for parameterized reads (`.all()`/`.get()`): rows populated asynchronously after the method returned. Tests passed only because they captured the array reference and asserted after `flush()`.

Scoped down to keep what works:

- Parameterized writes (`run(...params)`) implemented via `prepare/bind/step` API — store-and-check pattern is correct here because `run()` returns void
- Parameterized reads (`.all(...params)` / `.get(...params)`) deferred — both throw an explicit error pointing at mobile-shr0 for the Worker + Atomics.wait bridge
- `toBindParams` strict: rejects Date, plain object, function, etc. with helpful errors
- `bind_collection` return code now checked
- `close()` chains after pending work
- `trackPrepared` finalizes the statements iterator on throw
- Single-slot `lastError` overwrites surface via the optional `OpfsSqliteDriverOptions.onDroppedError` callback (project bans direct `console.error` use)

Will be marked completed once mobile-shr0 lands and parameterized reads return correct rows synchronously.

## Resolution

Parameterized reads now work via the OPFS Web Worker bridge. See mobile-shr0 for the implementation. `.all(...params)` and `.get(...params)` return correct rows via async resolution.
