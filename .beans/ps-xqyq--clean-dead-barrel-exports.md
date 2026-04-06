---
# ps-xqyq
title: Clean dead barrel exports
status: completed
type: task
priority: normal
created_at: 2026-04-06T00:52:54Z
updated_at: 2026-04-06T04:55:15Z
parent: ps-y621
---

~25 unused re-exports across multiple barrels:

- apps/mobile/src/connection/index.ts: 10 of 15 dead (ConnectionManagerConfig, ConnectionContextValue, ConnectionStateMachine, SseClient, SseClientConfig, ConnectionConfig, ConnectionEvent, ConnectionListener, ConnectionState, SseEventListener, SseLifecycleCallbacks)
- apps/mobile/src/auth/index.ts: 5 of 10 dead (AuthCtx, AuthCredentials, AuthEvent, AuthListener, AuthStateSnapshot)
- apps/mobile/src/platform/types.ts: PlatformStorage, StorageBackend
- apps/mobile/src/sync/SyncProvider.tsx: SyncContextValue, SyncProgress
- packages/api-client/src/index.ts: FetchOptions (CRITICAL — dead re-export)
- packages/data/src/index.ts: paths re-export

Audit ref: Pass 6 CRITICAL + HIGH + LOW

## Summary of Changes\n\nRemoved 17 dead barrel re-exports from connection, auth, platform, sync, api-client, and data barrels.
