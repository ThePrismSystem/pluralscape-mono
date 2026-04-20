---
# sync-z99z
title: "Test coverage: event-bus has no test file"
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-20T09:22:12Z
parent: sync-me6c
---

Finding [GAP-2] from audit 2026-04-20. packages/sync/src/event-bus/event-bus.ts. createEventBus factory (error handler path, multiple listeners, unsubscribe-while-iterating) untested. event-map.ts and event-bus/index.ts also uncovered.
