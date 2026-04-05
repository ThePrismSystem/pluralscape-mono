---
# ps-lvm3
title: Sync engine mobile adapters
status: completed
type: task
priority: normal
created_at: 2026-04-05T05:51:18Z
updated_at: 2026-04-05T16:04:15Z
parent: ps-vegi
---

Implement the four missing adapters needed to instantiate SyncEngine in the mobile app: SyncNetworkAdapter (wire WS client adapter), SyncStorageAdapter (persist Automerge binaries to local SQLite), DocumentKeyResolver (resolve encryption keys from CryptoProvider), ReplicationProfile.

## Summary of Changes

Wired the SyncProvider with all four adapters required for the sync pipeline:

- **SqliteStorageAdapter**: created from the platform's sqlite driver
- **DocumentKeyResolver**: created with master key, signing keys, BucketKeyCache, and sodium
- **BucketKeyCache**: in-memory LRU cache from `createBucketKeyCache()`
- **WsManager**: WebSocket network adapter created and connected within the provider

The provider creates the full pipeline when auth reaches "unlocked" state on a
sqlite-backed platform, bootstraps sync when the SSE connection reports "connected",
and tears down all resources on auth transitions or unmount. Errors are emitted
through the event bus rather than console. The context now exposes `progress: null`
for future extension.

## Summary of Changes

Wired all four sync engine adapters in SyncProvider: SqliteStorageAdapter, DocumentKeyResolver with BucketKeyCache, WsNetworkAdapter via WsManager, and ReplicationProfile (owner-full for native SQLite, owner-lite for web). Added bootstrap flow with progress tracking, cleanup on auth transitions, getAdapter() on WsManager, getWsUrl() config helper, and BootstrapGate component that gates app render during initial sync.
