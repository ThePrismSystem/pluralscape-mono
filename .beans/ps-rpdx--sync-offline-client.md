---
# ps-rpdx
title: Sync & offline client
status: completed
type: epic
priority: normal
created_at: 2026-03-31T23:12:35Z
updated_at: 2026-04-03T01:16:03Z
parent: ps-7j8n
---

CRDT sync engine integration, WebSocket client, SSE notification client, offline queue with replay

## Summary of Changes

Sync and offline client infrastructure in feat/m8-app-foundation (PR #352):

- ConnectionStateMachine with exponential backoff (1s-30s cap)
- SSE notification client using @microsoft/fetch-event-source (auth via headers)
- Unified ConnectionManager for WS + SSE with ConnectionProvider
- SyncProvider shell (engine wiring deferred pending relay transport)
- CRDT-to-React-Query bridge with DocumentSnapshotProvider interface
- Offline queue: IndexedDB adapter for web fallback (ADR 031)
