---
# sync-pl87
title: Automerge integration
status: in-progress
type: task
priority: high
created_at: 2026-03-08T13:35:02Z
updated_at: 2026-03-14T22:18:04Z
parent: sync-xlhb
blocking:
  - sync-5jne
  - sync-tf2p
---

Automerge library integration and document structure definitions

## Scope

- `automerge-repo` v2.5.x with pluggable storage/network adapters
- Document schema definitions matching domain types from types-im7i
- Automerge 3.0 changes: strings are natively collaborative, RawString→ImmutableString
- Binary document serialization
- Document creation, loading, forking, merging
- Change tracking and history access
- Performance baseline: measure merge time, document size, memory usage
- Storage adapter interface for local persistence (SQLite)
- Network adapter interface for sync transport (WebSocket)

## Acceptance Criteria

- [ ] automerge-repo installed and configured
- [ ] Document schemas defined for each topology document type
- [ ] Create/load/fork/merge operations working
- [ ] Binary serialization for storage
- [ ] Storage adapter interface defined
- [ ] Network adapter interface defined
- [ ] Performance benchmark: 1000 changes merge time
- [ ] Unit tests for document CRUD operations

## References

- ADR 005 (Automerge)
