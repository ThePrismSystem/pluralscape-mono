# ADR 031: Web Platform Storage Backend

## Status

Accepted

## Context

Pluralscape's mobile client uses SQLite (via expo-sqlite) for local CRDT document storage, offline mutation queuing, and sync state. The web client needs equivalent persistent storage to support offline-first operation, but browsers do not provide native SQLite access.

The sync package's existing abstractions (`SyncStorageAdapter`, `OfflineQueueAdapter`, `SqliteDriver`) are designed around SQLite. The web storage backend must integrate with these interfaces while providing reliable persistence across browser versions.

## Decision

Use a **tiered storage strategy** with automatic capability detection:

1. **OPFS + wa-sqlite** (preferred) — WebAssembly SQLite backed by the Origin Private File System. Provides full SQLite semantics, reuses the existing `SqliteDriver` interface and all SQLite-based adapters (`SqliteStorageAdapter`, `SqliteOfflineQueueAdapter`) without modification. Used when the browser supports OPFS with `createSyncAccessHandle` (Chrome 86+, Safari 16.4+, Firefox 111+).

2. **IndexedDB fallback** — For browsers without OPFS support. Implements the same `SyncStorageAdapter` and `OfflineQueueAdapter` interfaces but stores CRDT documents and queued mutations as blobs in IndexedDB. Data persists, offline works, but without SQLite's query capabilities.

3. **Auth token storage** is independent of the CRDT backend. Session tokens are always stored via IndexedDB or localStorage regardless of which tier is active. Authentication survives page refresh on all supported browsers.

At startup, the web platform adapter feature-detects OPFS availability and selects the best backend. The rest of the application interacts only with the adapter interfaces and is unaware of the underlying storage technology.

### Rationale

CRDT document storage is essential for offline-first operation on web — without local persistence, data is lost on page refresh and offline mode is impossible. wa-sqlite + OPFS provides the closest parity with mobile's native SQLite and maximizes code reuse across the existing adapter layer.

IndexedDB as a fallback ensures older browsers still get full persistence and a working offline experience. The tiered approach avoids forcing a lowest-common-denominator solution on modern browsers while maintaining broad compatibility.

Separating auth token storage from CRDT storage ensures that no browser version combination results in users being signed out on refresh.

## Alternatives Considered

| Alternative                         | Reason rejected                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| IndexedDB only                      | Loses SQLite query semantics; forces a separate adapter implementation for every storage consumer; no code reuse with mobile |
| OPFS + wa-sqlite only               | Excludes browsers without OPFS (notably Safari < 16.4, older iOS devices); degraded experience unacceptable                  |
| localStorage                        | 5-10 MB limit; synchronous API blocks main thread; unsuitable for CRDT document storage                                      |
| In-memory fallback for old browsers | Users lose all data on refresh and must re-authenticate; unacceptable UX                                                     |

## Consequences

- **Two web storage implementations to maintain.** The `SyncStorageAdapter` interface has both an `OpfsSqliteDriver`-backed implementation (reused from mobile) and an `IndexedDbStorageAdapter` implementation.
- **wa-sqlite becomes a web dependency.** Adds ~400KB to the web bundle (WASM module). Tree-shaking ensures it is not included in native builds.
- **Capability detection at startup.** The platform adapter must probe for OPFS support before initializing storage, adding a small async step to app initialization.
- **IndexedDB adapter is simpler but slower for complex queries.** Acceptable since the adapter interface constrains operations to simple key-value patterns (load/save snapshots, append/drain changes).
