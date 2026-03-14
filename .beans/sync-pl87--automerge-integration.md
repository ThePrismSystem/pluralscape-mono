---
# sync-pl87
title: Automerge integration
status: completed
type: task
priority: high
created_at: 2026-03-08T13:35:02Z
updated_at: 2026-03-14T22:50:20Z
parent: sync-xlhb
blocking:
  - sync-5jne
  - sync-tf2p
---

Automerge library integration and document structure definitions

## Scope

- `@automerge/automerge` with custom sync session and pluggable adapter interfaces
- Document schema definitions matching domain types from types-im7i
- Automerge 3.0 changes: strings are natively collaborative, RawString→ImmutableString
- Binary document serialization
- Document creation, loading, forking, merging
- Change tracking and history access
- Performance baseline: measure merge time, document size, memory usage
- Storage adapter interface for local persistence (SQLite)
- Network adapter interface for sync transport (WebSocket)

## Acceptance Criteria

- [x] @automerge/automerge integrated (no automerge-repo — custom EncryptedSyncSession)
- [ ] Document schemas defined for each topology document type
- [ ] Create/load/fork/merge operations working
- [ ] Binary serialization for storage
- [ ] Storage adapter interface defined
- [ ] Network adapter interface defined
- [ ] Performance benchmark: 1000 changes merge time
- [ ] Unit tests for document CRUD operations

## References

- ADR 005 (Automerge)

## Summary of Changes

- Defined typed Automerge schemas for all 6 sync document types (schemas/)
- Added ENTITY_CRDT_STRATEGIES registry for all 40+ entity types (strategies/)
- Implemented createDocument() factory with per-type and generic variants (factories/)
- Defined SyncStorageAdapter and SyncNetworkAdapter interfaces (adapters/)
- Added typed encrypted roundtrip tests for SystemCoreDocument, FrontingDocument, ChatDocument
- Added performance test verifying 1000-change merge criterion
- Updated index.ts to export all new modules
- 138 tests passing, typecheck clean, lint clean
