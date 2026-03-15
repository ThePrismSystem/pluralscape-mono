---
# sync-mxeg
title: CRDT sync protocol design and MVP
status: completed
type: epic
priority: normal
created_at: 2026-03-09T12:11:46Z
updated_at: 2026-03-15T07:31:17Z
parent: ps-vtws
---

Design and prototype the encrypted CRDT sync protocol before building API routes. Prove the Automerge-over-relay pattern works end-to-end with encrypted data. Covers: document topology design, per-entity conflict resolution strategies, encrypted operation relay, garbage collection, and partial replication. This is the single largest engineering risk in the project — every feature depends on the sync layer.

## Summary of Changes\n\nAll 5 children (document topology, per-entity conflict resolution, encrypted operation relay, garbage collection, partial replication) verified complete.
