---
# sync-f5f8
title: Add getDocumentSnapshot() to SyncEngine
status: todo
type: task
created_at: 2026-04-01T10:38:49Z
updated_at: 2026-04-01T10:38:49Z
---

SyncEngine in @pluralscape/sync needs to add a getDocumentSnapshot() method to implement DocumentSnapshotProvider before the CRDT query bridge can be wired to a real engine. Referenced by TODO in packages/data/src/crdt-query-bridge.ts:1.
