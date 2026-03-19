---
# sync-dupp
title: Tombstone enforcement
status: todo
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: sync-p1uq
---

Ensure archived entity tombstone flag wins over concurrent edits from other clients.

## Acceptance Criteria

- Unit test per entity type: archive on client A, edit on client B → archive wins after merge
- Tombstone flag propagates correctly through snapshot roundtrip (compact → restore → flag preserved)
- Tombstone applied even when edit has later Automerge timestamp (application-level rule overrides CRDT)
- Integration test: tombstone survives relay submit/fetch roundtrip (compact → relay → restore → flag preserved)
