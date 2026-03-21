---
# ps-afdr
title: "Fix all PR #230 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-21T08:40:29Z
updated_at: 2026-03-21T08:40:42Z
parent: ps-irrf
---

Fix 2 bugs and 9 suggestions from multi-model review of PR #230 (chore/m3-audit-low-severity): drain loop for offline queue, eviction error logging, WS close after rejection, JSDoc additions, mock reset, dead coverage exclusion removal, SSE state simplification, PubSubLogger reuse, and barrel deletion.

## Summary of Changes

### Bugs fixed

1. **CRITICAL**: `replayOfflineQueue()` now loops `drainUnsynced()` until queue is fully drained (was only calling once, missing entries beyond DRAIN_BATCH_SIZE of 500)
2. **IMPORTANT**: Bootstrap eviction errors are now logged via `onError` instead of silently swallowed

### Improvements

3. WS binary-frame and oversized-message rejection now closes the connection after sending error
4. Empty `catch {}` blocks in WS handler replaced with `log.debug()` calls
5. Oversized-message comment notes `String.length` counts UTF-16 code units
6. JSDoc added to `LazyDocumentSizeTracker.sizeBytes`
7. `vi.clearAllMocks()` added to valkey-pubsub test `beforeEach`
8. Dead `bun-adapter.ts` coverage exclusion removed from vitest.config.ts
9. `SseStateManager` class simplified to plain object literal
10. `PubSubLogger` now extends `Logger` from `@pluralscape/types` instead of standalone interface
11. `engine/compaction.ts` barrel deleted; `index.ts` imports directly from `compaction-handler.js`

### Tests added

- `offline-queue-manager.test.ts`: drain loop test with DRAIN_BATCH_SIZE + partial batch
- `sync-engine-bootstrap.test.ts`: eviction failure logs error but continues bootstrap
