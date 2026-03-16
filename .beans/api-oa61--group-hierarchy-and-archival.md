---
# api-oa61
title: Group hierarchy and archival
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:56:49Z
updated_at: 2026-03-16T11:58:08Z
parent: api-tzme
blocked_by:
  - api-2ev2
---

POST .../groups/:id/move (change parent, validate no cycles via ancestor walk). GET .../groups/tree (recursive CTE or client assembly). Batch sortOrder reorder. Archive/restore with cascade consideration.
