---
# mobile-l0fq
title: Add real-SQLite smoke test for expo-sqlite-driver
status: todo
type: task
priority: normal
created_at: 2026-04-08T02:08:47Z
updated_at: 2026-04-16T06:44:45Z
parent: ps-8coo
---

PR #399 raised apps/mobile/src/platform/drivers/expo-sqlite-driver.ts from 0% to 100% coverage via the in-memory expo-sqlite-mock.ts. The mock returns pre-seeded rows keyed by exact SQL string and does not roll back transactions on exception. The wrapper logic is covered, but SQL semantics, transaction rollback, bind-parameter ordering, and statement-handle leaks are not.

## Scope

- Add one integration smoke test that exercises the driver against real better-sqlite3 (Node) or a device/simulator (Expo)
- Cover: real SELECT/INSERT/UPDATE, transaction commit, transaction rollback on throw, statement finalization
- Does not need to be a full test suite — one smoke test is enough to catch SQL regressions

## Why

From the review: '100% coverage on expo-sqlite-driver.ts validates the wrapper calls the right API surface, not that SQL/transactions actually work. Recommend adding one integration smoke test against real better-sqlite3 or device.'

The current mock at apps/mobile/src/**tests**/expo-sqlite-mock.ts returns rows keyed by exact SQL string match, so:

- SQL syntax regressions pass the tests
- Bind-parameter mis-ordering is not caught
- Transaction-rollback semantics are not exercised
- Statement-handle leaks are invisible

## Parent

Created as follow-up from ps-1o81 (PR #399 review fixes).
