---
# ps-gfs3
title: "Hook refactoring: read path from local SQLite"
status: completed
type: task
priority: normal
created_at: 2026-04-05T05:51:13Z
updated_at: 2026-04-05T16:04:19Z
parent: ps-vegi
---

Refactor all data hooks to read from local SQLite instead of tRPC. Depends on sync engine adapters (storage adapter, key resolver, replication profile) being implemented. Also includes write path shift: mutations write to local Automerge document first, then sync via offline queue.

## Summary of Changes

Refactored all data hooks to read from local SQLite via useQuerySource()/useLocalDb(). Added row transform functions for all synced entity types, DataQuery/DataListQuery union types, bootstrap gate, and updated test infrastructure. Hooks use local SQLite when platform supports it and sync is bootstrapped, with tRPC fallback for web platforms without SQLite. Mutation hooks deferred to write path task. Server-only hooks (API keys, account, blobs, audit log) left unchanged.
