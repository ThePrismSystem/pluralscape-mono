---
# db-jc10
title: Fix syncQueue UUID v4 ordering issue
status: todo
type: bug
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T04:47:31Z
parent: db-2je4
---

Code comment acknowledges UUID PKs don't guarantee insertion order but takes no action. Switch to UUIDv7 or add autoincrement sequence for replay ordering. Ref: audit M7
