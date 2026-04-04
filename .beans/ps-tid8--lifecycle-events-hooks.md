---
# ps-tid8
title: Lifecycle events hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:11:51Z
updated_at: 2026-04-04T19:45:04Z
parent: ps-j47j
---

CRUD, timeline display

Uses trpc.lifecycleEvent.\* (list, get, create, update, delete).

## Summary of Changes

Implemented lifecycle event data hooks with encrypted pattern:

- useLifecycleEvent (encrypted single query)
- useLifecycleEventsList (encrypted paginated list)
- 5 mutations (create, update, archive, restore, delete)

All tests passing.
