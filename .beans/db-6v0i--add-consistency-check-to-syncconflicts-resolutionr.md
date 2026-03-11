---
# db-6v0i
title: Add consistency CHECK to syncConflicts resolution/resolvedAt
status: todo
type: bug
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T19:39:45Z
parent: db-gt84
---

resolution nullable without check against resolvedAt. Add: IF resolvedAt IS NOT NULL THEN resolution IS NOT NULL. Ref: audit M9
