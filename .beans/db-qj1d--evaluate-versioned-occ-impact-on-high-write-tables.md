---
# db-qj1d
title: Evaluate versioned() OCC impact on high-write tables
status: completed
type: task
priority: low
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T10:00:27Z
parent: db-2nr7
---

Optimistic locking via version increment on every update adds write to high-frequency tables. At scale, verify OCC retry rates don't cause hot-row contention. Ref: audit L7

## Evaluation

**High-write tables**: `fronting_sessions` (frequent endTime/lastActive updates), `sync_documents` (every sync cycle).

**Low risk**: `sync_queue` is append-only (no version column). `messages` are append-only (rarely edited). OCC contention is only relevant at 1000+ concurrent sync ops on the same document row.

**Mitigation**: Automerge CRDT sync handles conflict resolution client-side, reducing server-side OCC pressure. The server version column is a last-write-wins fallback, not the primary conflict resolution mechanism.

**Recommendation**: Accept. Monitor retry rates in production telemetry before optimizing. If contention emerges on `fronting_sessions`, consider batching lastActive updates or using a separate heartbeat column without OCC.

## Summary of Changes\n\nEvaluated OCC impact on high-write tables. Risk is low — sync_queue is append-only, CRDT handles conflicts client-side. Monitor retry rates in production.
