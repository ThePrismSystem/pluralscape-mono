---
# ps-vegi
title: Local data layer & search
status: completed
type: epic
priority: normal
created_at: 2026-04-04T18:36:06Z
updated_at: 2026-04-05T05:51:40Z
parent: ps-7j8n
---

Local SQLite database, FTS5 search indexes (system + friend data), CRDT sync data layer, offline-first query infrastructure. Pulled forward from M11 — required foundation for search hooks and offline-first architecture.

## Summary of Changes

Implemented the local data layer and search infrastructure for offline-first functionality:

**packages/sync (event bus, materializer, WS adapter):**

- Typed event bus for decoupled component communication (12 event types)
- Entity table registry mapping all 36+ CRDT entity types to local SQLite schemas
- DDL generator for entity tables, FTS5 virtual tables, and sync triggers
- Base materializer with entity diffing and document/entity-level event emission
- Document materializers for all 5 active CRDT document types
- WebSocket client adapter with notification demuxing replacing SSE as primary transport
- Sync engine event bus integration (emits sync events after merges)

**apps/api (notification bridge):**

- Server-side notification bridge pushing notifications over WS connections

**apps/mobile (data layer, search, connection):**

- Local SQLite database manager with DDL initialization
- Query invalidator bridging materialization events to React Query
- WebSocket manager with mobile lifecycle awareness and reconnection
- DataLayerProvider wiring event bus, local DB, and query invalidation into provider tree
- SyncProvider wired with event bus (full engine pending adapter implementation)
- Friend data indexer with event-driven re-indexing from export API
- FTS5 search hook with self/friend scope and bm25 ranking

**Deferred to follow-up beans:**

- ps-lvm3: Sync engine mobile adapters (storage, key resolver, replication profile)
- ps-gfs3: Hook refactoring (read path from local SQLite, write path shift)
- ps-oip9: Extend CRDT sync to all entity types
