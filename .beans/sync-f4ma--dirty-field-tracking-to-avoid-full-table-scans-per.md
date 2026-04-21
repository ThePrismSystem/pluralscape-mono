---
# sync-f4ma
title: Dirty-field tracking to avoid full-table scans per sync
status: completed
type: task
priority: high
created_at: 2026-04-20T09:22:12Z
updated_at: 2026-04-21T00:33:14Z
parent: sync-me6c
---

Finding [PERF-02] from audit 2026-04-20. packages/sync/src/materializer/materialize-document.ts:41. Every entity type triggers queryAll<EntityRow>; system-core has ~25 entity types. SQLite queried 25x even if only one changed. Fix: pass dirty-field set from CRDT change to skip unchanged types.

## Summary of Changes

materializeDocument and DocumentMaterializer.materialize accept an
optional `dirtyEntityTypes: ReadonlySet<string>`. Clean types skip
queryAll entirely — no SQL is issued for them. Legacy call-sites that
omit the set keep the full-scan behaviour.

Saves up to N SQLite scans per merge where N is the number of entity
types unaffected by a change (e.g. system-core has 20+ types; a
member-only change now issues one queryAll instead of all of them).
