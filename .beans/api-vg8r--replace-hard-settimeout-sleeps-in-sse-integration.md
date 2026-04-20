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

Replaced bare new Promise(r => setTimeout(r, n)) calls in the SSE stream integration suite with deadline-polling helpers (waitFor, waitForStable) wherever an observable side-effect exists (pubsub.unsubscribe call count, pubsub warn count). A named sleep() helper wraps the few remaining wall-clock waits — the buffered-replay test uses a ReadableStream fanout path with no observable settle signal, and the socket-close handshake needs a brief backpressure wait that polling cannot replace. Ran 5x in a loop to confirm stability (5/5 pass).
