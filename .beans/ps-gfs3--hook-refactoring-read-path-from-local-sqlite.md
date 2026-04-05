---
# ps-gfs3
title: "Hook refactoring: read path from local SQLite"
status: in-progress
type: task
priority: normal
created_at: 2026-04-05T05:51:13Z
updated_at: 2026-04-05T09:53:12Z
parent: ps-vegi
---

Refactor all data hooks to read from local SQLite instead of tRPC. Depends on sync engine adapters (storage adapter, key resolver, replication profile) being implemented. Also includes write path shift: mutations write to local Automerge document first, then sync via offline queue.
