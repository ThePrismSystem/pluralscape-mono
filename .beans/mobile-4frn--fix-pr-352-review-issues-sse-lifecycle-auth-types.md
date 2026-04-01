---
# mobile-4frn
title: "Fix PR #352 review issues: SSE lifecycle, auth types, error handling, cleanups"
status: completed
type: task
priority: normal
created_at: 2026-04-01T07:16:29Z
updated_at: 2026-04-01T07:33:14Z
---

Fix all critical (#1-4) and important (#5-11) issues from PR #352 review, plus suggestions #14-19. Covers SSE lifecycle callbacks, OPFS bind params, discriminated AuthStateSnapshot, AuthGate/layout fixes, error handling, and idbRequest extraction.

## Summary of Changes

### Commit 1: SSE lifecycle callbacks + ConnectionManager async connect

- Added `SseEvent` discriminated union and `SseLifecycleCallbacks` interface to connection-types.ts
- SseClient now accepts lifecycle callbacks (onConnected/onDisconnected/onError) in constructor
- Malformed JSON is silently dropped instead of passed as raw string to listeners
- ConnectionManager passes lifecycle callbacks so CONNECTED is dispatched by SSE onopen (not prematurely)
- State is `connecting` until SSE actually opens, not immediately `connected`

### Commit 2: OPFS driver throws on bind params

- `run()` and `all()` throw explicit error when params are passed (instead of silently dropping)

### Commit 3: Discriminated AuthStateSnapshot + exhaustive switches

- AuthStateSnapshot is now a discriminated union narrowing session/credentials per state
- Added exhaustive `default: never` to auth-state-machine, connection-state-machine dispatchers
- AuthContextValue exposes typed `snapshot` field for downstream consumers
- ConnectionProvider uses `auth.snapshot` directly instead of reconstructing

### Commit 4: AuthGate/layout + partial-failure safety

- AuthGate wraps Slot as children (not sibling)
- Removed duplicate auth guard from (app)/\_layout.tsx
- Module-level singletons moved into useRef with ??= lazy init
- Removed unused wsUrl from CONNECTION_CONFIG
- Promises have .catch() to prevent unhandled rejections
- login() dispatches first, rolls back on token store failure
- logout() dispatches first (stale token acceptable)

### Commit 5: Error handling fixes

- detect.ts: empty catch now captures error variable
- IndexedDB adapters: close() has .catch() to prevent unhandled rejections

### Commit 6: Extract idbRequest + minor cleanups

- Shared idbRequest extracted to indexeddb-utils.ts (3 files deduplicated)
- recovery-key-service.ts: uses RecoveryKeyDisplay branded type, removes `as string` cast
- expo-sqlite-driver: removed async/await hack, returns Promise.resolve(driver)
