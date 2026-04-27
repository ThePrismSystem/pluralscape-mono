---
# sync-xjfi
title: Wire materializerRegistry.materialize into data-layer write path
status: todo
type: task
priority: normal
created_at: 2026-04-21T03:02:54Z
updated_at: 2026-04-27T20:28:57Z
parent: ps-cd6x
---

PR #531 added dirtyEntityTypes scaffolding to materializeDocument / materializer.materialize(), but no production code invokes either — the materializer is only exercised in tests. Wire into the production data-layer write path (likely in @pluralscape/data or wherever materialized:document events should be emitted). Until done, the sync-f4ma perf gain is unreachable.
