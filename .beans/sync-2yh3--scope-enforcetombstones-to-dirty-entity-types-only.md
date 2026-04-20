---
# sync-2yh3
title: Scope enforceTombstones to dirty entity types only
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-20T09:22:12Z
parent: sync-me6c
---

Finding [PERF-03] from audit 2026-04-20. packages/sync/src/post-merge-validator.ts:131-176. Iterates ALL lww-map entities on every merge (20+ types, potentially thousands). Only run tombstone enforcement on entity types whose fields appear in the incoming change set.
