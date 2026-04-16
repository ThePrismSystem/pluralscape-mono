---
# ps-ngrl
title: "Fix PR #195 review issues"
status: completed
type: task
priority: normal
created_at: 2026-03-20T04:44:24Z
updated_at: 2026-04-16T07:29:46Z
parent: ps-afy4
---

Address 4 critical, 6 important, and 7 suggestion items from PR review

## Checklist

- [x] Item 1: Forward `limit` in handleFetchChanges (handlers.ts)
- [x] Item 2: Fix persist-then-apply ordering (sync-engine.ts)
- [x] Item 3: Make onError required so hydration failures are never silent
- [x] Item 4: Add onError callback to WsNetworkAdapter, fix empty catches
- [x] Item 5: Add close() to WsNetworkAdapter
- [x] Item 6: Wrap dispose() adapter close calls in try/catch
- [x] Item 7: Complete stale document eviction test
- [x] Item 8: Add PgSyncRelayService integration tests
- [x] Item 9: Route handleIncomingChanges through document queue
- [x] Item 11: Log VERSION_CONFLICT in submitSnapshot
- [x] Item 12: Extract persistChanges helper
- [x] Item 13: Add mapConcurrent comment
- [x] Item 14: Fix redundant has()+get()
- [x] Item 16: Document unsound getSession cast
- [x] Item 17: Type createdAt/updatedAt as UnixMillis
- [x] Item 18: Fix submitChange error message format
- [x] Run all tests

## Summary of Changes

Addressed all 17 review items from PR #195:

- Critical: Fixed limit forwarding, apply-before-persist ordering, made onError required, added error callbacks to WsNetworkAdapter
- Important: Added close(), try/catch in dispose(), queue routing for handleIncomingChanges, completed eviction test, added relay integration tests, VERSION_CONFLICT logging
- Suggestions: Extracted persistChanges helper, added mapConcurrent comment, fixed redundant has+get, documented getSession cast, typed timestamps as UnixMillis, fixed error message format
