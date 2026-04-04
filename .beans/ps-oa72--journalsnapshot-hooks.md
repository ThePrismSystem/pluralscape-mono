---
# ps-oa72
title: Journal/snapshot hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:12:34Z
updated_at: 2026-04-04T10:27:33Z
parent: ps-yspo
---

Entry CRUD, wiki-linking, timeline queries

Uses trpc.snapshot.\* for entry CRUD, wiki-linking, and timeline queries.

## Summary of Changes

Implemented snapshot hook with transform and test:

- use-snapshots.ts (encrypted read-only + create/delete, 4 hooks)

1 transform: snapshot (SnapshotContent blob)
1 test file with 8 tests
