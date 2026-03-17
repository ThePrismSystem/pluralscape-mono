---
# api-oa61
title: Group hierarchy and archival
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:56:49Z
updated_at: 2026-03-17T21:40:23Z
parent: api-tzme
blocked_by:
  - api-2ev2
---

POST .../groups/:id/move (change parent, validate no cycles via ancestor walk). GET .../groups/tree (recursive CTE or client assembly). Batch sortOrder reorder. Archive/restore with cascade consideration.

## Summary of Changes\n\nGroup hierarchy: move with cycle detection, tree assembly, batch reorder, archive, and restore.
