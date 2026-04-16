---
# db-lrk6
title: Deduplicate type aliases in pg/index.ts and sqlite/index.ts
status: completed
type: task
priority: low
created_at: 2026-03-10T09:03:16Z
updated_at: 2026-04-16T07:29:38Z
parent: ps-vtws
---

pg/index.ts and sqlite/index.ts have identical type alias blocks (~30 lines each) that compound with every schema batch. Refactor options: move Row/New types into individual schema files, or create a shared type generation approach.

## Summary of Changes

Moved `*Row` and `New*` type exports from the monolithic index files into their individual schema files, co-located with each table definition.

### Approach

- Added `import type { InferInsertModel, InferSelectModel } from "drizzle-orm"` to all 53 schema files (26 PG + 27 SQLite) that lacked it
- Appended `export type XRow = InferSelectModel<typeof x>` and `export type NewX = InferInsertModel<typeof x>` at the bottom of each file
- Rewrote `pg/index.ts` and `sqlite/index.ts` to use `export type { ... } from './file.js'` re-exports instead of inline type alias definitions
- Public API is fully preserved — all existing imports remain unbroken
- Verified with `pnpm typecheck` (no new errors) and `pnpm lint` (no new errors in schema files)
