---
# db-2g05
title: Add >= 1 check to versioned() helper itself
status: todo
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T19:39:45Z
parent: db-gt84
---

versioned() sets default 1 but only some tables add explicit >= 1 check. Move check into helper for consistency. Ref: audit M2
