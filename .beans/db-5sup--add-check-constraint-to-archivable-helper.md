---
# db-5sup
title: Add CHECK constraint to archivable() helper
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T00:49:49Z
parent: db-gt84
---

No CHECK that archived=true iff archivedAt IS NOT NULL. A row can be archived without timestamp or have timestamp while archived=false. Ref: audit M1

## Summary of Changes

Implemented via the same commit as db-2g05. `archivableConsistencyCheck(archived, archivedAt)` enforces `(archived = true) = (archivedAt IS NOT NULL)` on all 9 archivable tables.
