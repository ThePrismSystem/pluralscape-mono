---
# ps-lucr
title: Exclude bun-adapter.ts and sqlite-driver.ts from coverage
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:02:49Z
parent: ps-i3xl
---

0% because Bun-only, add to vitest exclude

## Summary of Changes\n\nAdded packages/sync/src/adapters/bun-adapter.ts and packages/sync/src/adapters/sqlite-driver.ts to vitest coverage exclude array (Bun-only files producing 0% coverage in Node).
