---
# api-a3jz
title: "L11: Consider entity-lifecycle for friend connection archive"
status: todo
type: task
priority: low
created_at: 2026-03-28T21:28:03Z
updated_at: 2026-03-28T21:28:03Z
parent: ps-tkuz
---

**Audit:** M6 audit finding L11 (Refactor)
**File:** `apps/api/src/services/friend-connection.service.ts:512-623`

`bucket.service.ts` delegates to `archiveEntity`/`restoreEntity` from `lib/entity-lifecycle.ts`. Friend connections implement inline. Account-level RLS context makes unification non-trivial.

**Fix:** Extend `entity-lifecycle.ts` to support account-scoped entities, or document the divergence.
