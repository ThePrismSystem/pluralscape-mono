---
# db-5sup
title: Add CHECK constraint to archivable() helper
status: todo
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T19:39:45Z
parent: db-gt84
---

No CHECK that archived=true iff archivedAt IS NOT NULL. A row can be archived without timestamp or have timestamp while archived=false. Ref: audit M1
