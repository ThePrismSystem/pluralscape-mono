---
# sync-f4ma
title: Dirty-field tracking to avoid full-table scans per sync
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-20T09:22:12Z
parent: sync-me6c
---

Finding [PERF-02] from audit 2026-04-20. packages/sync/src/materializer/materialize-document.ts:41. Every entity type triggers queryAll<EntityRow>; system-core has ~25 entity types. SQLite queried 25x even if only one changed. Fix: pass dirty-field set from CRDT change to skip unchanged types.
