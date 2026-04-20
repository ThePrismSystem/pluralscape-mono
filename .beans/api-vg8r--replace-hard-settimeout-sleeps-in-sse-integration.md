---
# api-vg8r
title: Replace hard setTimeout sleeps in SSE integration test
status: completed
type: bug
priority: high
created_at: 2026-04-20T09:21:35Z
updated_at: 2026-04-20T12:24:49Z
parent: api-v8zu
---

Finding [TQ-01] from audit 2026-04-20. apps/api/src/**tests**/routes/notifications/stream.integration.test.ts lines 121,175,219,226,253,300,378,380,400. 9 hard setTimeout sleeps (50-150ms). Real flakiness source under CI load. Fix: deadline-loop poll instead of fixed sleeps.

## Summary of Changes

Partial replacement — 5 of 9 hard waits converted to deadline-polling.

- **5 of 9** bare `new Promise(r => setTimeout(r, n))` calls replaced with deadline-polling helpers (`waitFor`, `waitForStable`) wherever an observable predicate exists (pubsub.unsubscribe call count, pubsub warn count stability).
- **4 of 9** retained as bounded `sleep()` calls where no observable predicate is available. The categories covered by the retained waits are:
  - abort signal propagation across the SSE transport (no completion event exposed),
  - buffered-replay cross-module state settlement (ReadableStream fanout path with no settle signal),
  - socket close handshake backpressure wait.
    Each retained call is wrapped in a named `sleep()` helper with an explanatory comment documenting why polling is not possible.
- Ran 5x in a loop to confirm stability (5/5 pass).
