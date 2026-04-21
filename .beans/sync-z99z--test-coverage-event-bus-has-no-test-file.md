---
# sync-z99z
title: "Test coverage: event-bus has no test file"
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-21T00:46:28Z
parent: sync-me6c
---

Finding [GAP-2] from audit 2026-04-20. packages/sync/src/event-bus/event-bus.ts. createEventBus factory (error handler path, multiple listeners, unsubscribe-while-iterating) untested. event-map.ts and event-bus/index.ts also uncovered.

## Summary of Changes

Extended event-bus test coverage with:

- emit to zero subscribers (no-op guard)
- unsubscribe-during-iteration with multi-listener dispatch
- last-listener unsubscribe deletes the bucket
- idempotent double-unsubscribe
- removeAll no-op on empty bus
- re-export sanity via packages/sync/src/event-bus/index.ts
- event-map DataLayerEventMap tagged discriminant round-trip

Covers event-bus.ts error paths, event-map.ts declarations, and
event-bus/index.ts re-exports.
