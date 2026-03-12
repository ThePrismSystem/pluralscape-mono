---
# db-7xrs
title: Evaluate dual indexes on lifecycleEvents
status: completed
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T10:00:28Z
parent: db-2nr7
---

(system_id, occurred_at) and (system_id, recorded_at) both maintained. Write amplification for append-heavy table. Check if recorded_at queries are actually issued. Ref: audit L5

## Evaluation

**Index purposes**:

- `(system_id, occurred_at)` — timeline views ("what happened when")
- `(system_id, recorded_at)` — sync ordering ("what was recorded since last sync")

**Write cost**: Two B-tree updates per INSERT, but lifecycle events are append-only (no updates), so lock contention is zero. The write amplification is a single page split per index per insert — negligible for an event log table.

**Recommendation**: Keep both. The `recorded_at` index is critical for the sync protocol — without it, determining "events recorded since last sync" would require a full table scan filtered by system_id. Write amplification cost is negligible for append-only data.

## Summary of Changes\n\nEvaluated dual indexes on lifecycleEvents. Both indexes serve distinct query patterns (timeline vs sync). Keep both — write amplification is negligible for append-only data.
