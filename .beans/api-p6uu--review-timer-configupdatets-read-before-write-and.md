---
# api-p6uu
title: Review timer-config/update.ts read-before-write and Record<string,unknown> cast
status: todo
type: task
created_at: 2026-04-22T02:43:04Z
updated_at: 2026-04-22T02:43:04Z
parent: api-6l1q
---

Flagged by api-hnso during the api-6l1q refactor.

## Problems

### 1. Read-before-write pattern

`apps/api/src/services/timer-config/update.ts:71-100` — the update path issues a SELECT to fetch the current row before computing `nextCheckInAt`, then issues a separate UPDATE. When no scheduling fields are included in the update payload, this SELECT is pure overhead. Could collapse into a single `UPDATE ... RETURNING`.

### 2. Drizzle type-cast on .set()

`apps/api/src/services/timer-config/update.ts:110` — preserves `as Record<string, unknown>` cast on drizzle `.set()` that mixes typed cols with a `sql` expression. The cast hides whether the underlying types are correctly constrained. Worth a deeper review to see if a narrower type or a drizzle `sql`-wrapper helper would eliminate the cast.

## Scope

- Measure actual overhead of the extra SELECT under realistic load
- If non-trivial, consolidate to a single UPDATE when scheduling fields are absent
- Replace the `as Record<string, unknown>` cast with a properly narrowed type or helper
- Preserve existing test coverage

## Acceptance

- Fewer SQL roundtrips on the non-scheduling update path
- No type cast on the .set() call
- No regressions
