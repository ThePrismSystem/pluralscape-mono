---
# sync-f5f8
title: Add getDocumentSnapshot() to SyncEngine
status: completed
type: task
priority: normal
created_at: 2026-04-01T10:38:49Z
updated_at: 2026-04-16T07:29:52Z
parent: ps-n8uk
---

SyncEngine in @pluralscape/sync needs to add a getDocumentSnapshot() method to implement DocumentSnapshotProvider before the CRDT query bridge can be wired to a real engine. Referenced by TODO in packages/data/src/crdt-query-bridge.ts:1.

## Summary of Changes

Added getDocumentSnapshot() method to SyncEngine that returns the current Automerge document for a given document ID. Throws NoActiveSessionError if the document is not loaded. Structurally satisfies DocumentSnapshotProvider from @pluralscape/data. Removed TODO comment from crdt-query-bridge.ts.
